import type { SourceAuthorityProvider } from "@/src/server/source-authority/contracts";

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

function markProviderSuccess(provider: SourceAuthorityProvider): void {
  const health = healthFor(provider);
  health.consecutiveFailures = 0;
  health.cooldownUntil = null;
  health.lastFailureReason = null;
  health.lastSuccessAt = Date.now();
}

function markProviderFailure(provider: SourceAuthorityProvider, reason: string, retryAfterMs: number | null): void {
  const health = healthFor(provider);
  health.consecutiveFailures += 1;
  health.lastFailureAt = Date.now();
  health.lastFailureReason = reason;
  const cooldownMs = retryAfterMs ?? Math.min(BASE_BACKOFF_MS * 2 ** Math.min(health.consecutiveFailures, 5), MAX_BACKOFF_MS);
  health.cooldownUntil = Date.now() + cooldownMs;
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

export function resetSourceProviderHealth(): void {
  providerHealth.clear();
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
        markProviderSuccess(options.provider);
        return response;
      }

      const retryAfterMs = response.status === 429 ? parseRetryAfter(response.headers.get("retry-after")) : null;
      lastError = new Error(`Source provider returned HTTP ${response.status}.`);
      markProviderFailure(options.provider, fetchErrorMessage(lastError), retryAfterMs);
      if (response.status !== 429 && response.status < 500) break;
      if (attempt < maxAttempts) await sleep(backoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      markProviderFailure(options.provider, fetchErrorMessage(error), null);
      if (attempt < maxAttempts) await sleep(backoffDelay(attempt, null));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
