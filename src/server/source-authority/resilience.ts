import type { SourceAuthorityProvider } from "@/src/server/source-authority/contracts";
import {
  providerRuntimeStateRepository,
  type ProviderRuntimeState,
  type ProviderRuntimeStateUpdate
} from "@/src/server/repositories/provider-runtime-state-repository";

export type SourceProviderHealth = {
  provider: SourceAuthorityProvider;
  consecutiveFailures: number;
  cooldownUntil: number | null;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  lastFailureReason: string | null;
};

export type ResilientFetchOptions = {
  provider: SourceAuthorityProvider;
  accept: string;
  userAgent?: string;
  timeoutMs?: number;
  maxAttempts?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 2_000;

const providerHealth = new Map<SourceAuthorityProvider, SourceProviderHealth>();
let providerRuntimeStore: {
  list(): Promise<ProviderRuntimeState[]>;
  record(update: ProviderRuntimeStateUpdate): Promise<ProviderRuntimeState>;
} | null = providerRuntimeStateRepository;

function emptyHealth(provider: SourceAuthorityProvider): SourceProviderHealth {
  return {
    provider,
    consecutiveFailures: 0,
    cooldownUntil: null,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastFailureReason: null
  };
}

function healthFor(provider: SourceAuthorityProvider): SourceProviderHealth {
  const existing = providerHealth.get(provider);
  if (existing) return existing;
  const created = emptyHealth(provider);
  providerHealth.set(provider, created);
  return created;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return null;
}

function backoffDelay(attempt: number, retryAfterMs: number | null): number {
  if (retryAfterMs !== null) {
    return Math.min(retryAfterMs, MAX_BACKOFF_MS);
  }
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS);
}

function stateToHealth(state: ProviderRuntimeState): SourceProviderHealth {
  return {
    provider: state.provider,
    consecutiveFailures: state.consecutiveFailures,
    cooldownUntil: state.cooldownUntil,
    lastFailureAt: state.lastFailureAt,
    lastSuccessAt: state.lastSuccessAt,
    lastFailureReason: state.lastFailureReason
  };
}

async function persistProviderRuntimeState(update: ProviderRuntimeStateUpdate): Promise<SourceProviderHealth | null> {
  if (!providerRuntimeStore) return null;
  try {
    const persisted = await providerRuntimeStore.record(update);
    const health = stateToHealth(persisted);
    providerHealth.set(update.provider, health);
    return health;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        component: "source_provider_resilience",
        message: "Provider runtime state persistence failed.",
        provider: update.provider,
        error: error instanceof Error ? error.message : String(error)
      })
    );
    return null;
  }
}

async function markProviderSuccess(provider: SourceAuthorityProvider): Promise<void> {
  const occurredAt = Date.now();
  const health = healthFor(provider);
  health.consecutiveFailures = 0;
  health.cooldownUntil = null;
  health.lastFailureReason = null;
  health.lastSuccessAt = occurredAt;
  await persistProviderRuntimeState({ provider, outcome: "success", occurredAt });
}

async function markProviderFailure(provider: SourceAuthorityProvider, reason: string, retryAfterMs: number | null): Promise<void> {
  const occurredAt = Date.now();
  const health = healthFor(provider);
  health.consecutiveFailures += 1;
  health.lastFailureAt = occurredAt;
  health.lastFailureReason = reason;
  const cooldownMs = retryAfterMs ?? Math.min(BASE_BACKOFF_MS * 2 ** Math.min(health.consecutiveFailures, 5), MAX_BACKOFF_MS);
  health.cooldownUntil = occurredAt + cooldownMs;
  await persistProviderRuntimeState({
    provider,
    outcome: "failure",
    occurredAt,
    cooldownUntil: health.cooldownUntil,
    reason
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function getSourceProviderHealth(): SourceProviderHealth[] {
  return Array.from(providerHealth.values()).map((health) => ({ ...health }));
}

export async function loadPersistentSourceProviderHealth(): Promise<SourceProviderHealth[]> {
  if (!providerRuntimeStore) return getSourceProviderHealth();
  const persisted = await providerRuntimeStore.list();
  providerHealth.clear();
  for (const state of persisted) {
    providerHealth.set(state.provider, stateToHealth(state));
  }
  return getSourceProviderHealth();
}

export function resetSourceProviderHealth(): void {
  providerHealth.clear();
}

export function setSourceProviderRuntimeStoreForTests(
  store: {
    list(): Promise<ProviderRuntimeState[]>;
    record(update: ProviderRuntimeStateUpdate): Promise<ProviderRuntimeState>;
  } | null
): void {
  providerRuntimeStore = store;
}

export function providerInCooldown(provider: SourceAuthorityProvider): boolean {
  const cooldownUntil = healthFor(provider).cooldownUntil;
  return typeof cooldownUntil === "number" && cooldownUntil > Date.now();
}

export async function resilientFetch(url: string, options: ResilientFetchOptions): Promise<Response> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: options.accept,
          ...(options.userAgent ? { "user-agent": options.userAgent } : {})
        }
      });
      if (response.ok) {
        await markProviderSuccess(options.provider);
        return response;
      }

      const retryAfterMs = response.status === 429 ? parseRetryAfter(response.headers.get("retry-after")) : null;
      lastError = new Error(`Source provider returned HTTP ${response.status}.`);
      await markProviderFailure(options.provider, fetchErrorMessage(lastError), retryAfterMs);
      if (response.status !== 429 && response.status < 500) break;
      if (attempt < maxAttempts) await sleep(backoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      await markProviderFailure(options.provider, fetchErrorMessage(error), null);
      if (attempt < maxAttempts) await sleep(backoffDelay(attempt, null));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
