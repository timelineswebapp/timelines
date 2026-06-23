import type { SourceAuthorityProvider } from "@/src/server/source-authority/contracts";
import { config } from "@/src/lib/config";
import { adminSecurityAuditRepository } from "@/src/server/repositories/admin-security-audit-repository";
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
const MAX_REDIRECT_HOPS = 5;
const PROVIDER_ALLOWED_HOSTS: Record<SourceAuthorityProvider, string[]> = {
  wikidata: ["www.wikidata.org", "wikidata.org"],
  dbpedia: ["lookup.dbpedia.org", "dbpedia.org"],
  library_of_congress: ["www.loc.gov", "loc.gov"],
  nara: ["catalog.archives.gov"]
};
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function persistSourceAuthoritySecurityViolation(rawUrl: string, reason: string, provider: SourceAuthorityProvider): void {
  void adminSecurityAuditRepository.append({
    eventType: "admin_security_violation",
    operatorId: null,
    authMethod: null,
    roles: [],
    mfaVerified: false,
    method: "GET",
    pathname: "/source-authority/fetch",
    details: {
      provider,
      url: rawUrl,
      reason
    }
  }).catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        component: "source_provider_resilience",
        message: "Source Authority security audit persistence failed.",
        error: error instanceof Error ? error.message : String(error)
      })
    );
  });
}

const providerHealth = new Map<SourceAuthorityProvider, SourceProviderHealth>();
const providerRuntimeState = new Map<SourceAuthorityProvider, ProviderRuntimeState>();
let providerRuntimeStore: {
  list(): Promise<ProviderRuntimeState[]>;
  record(update: ProviderRuntimeStateUpdate): Promise<ProviderRuntimeState>;
} | null = providerRuntimeStateRepository;
let runtimeInitializationPromise: Promise<SourceProviderHealth[]> | null = null;
let runtimeInitialized = false;

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
    providerRuntimeState.set(update.provider, persisted);
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

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts as [number, number, number, number];
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 0) ||
    first >= 224
  );
}

function normalizedHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function isBlockedNetworkHostname(hostname: string): boolean {
  const normalized = normalizedHostname(hostname);
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "metadata.google.internal" ||
    normalized === "169.254.169.254" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    isPrivateIpv4(normalized)
  );
}

function assertProviderUrlAllowed(provider: SourceAuthorityProvider, rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    persistSourceAuthoritySecurityViolation(rawUrl, "invalid_url", provider);
    throw new Error("Source provider URL is invalid.");
  }

  if (parsed.protocol !== "https:") {
    persistSourceAuthoritySecurityViolation(rawUrl, "unsafe_scheme", provider);
    throw new Error("Source provider URL must use HTTPS.");
  }

  if (isBlockedNetworkHostname(parsed.hostname)) {
    persistSourceAuthoritySecurityViolation(rawUrl, "blocked_network_target", provider);
    throw new Error("Source provider URL host resolves to a blocked network target.");
  }

  const allowedHosts = PROVIDER_ALLOWED_HOSTS[provider];
  if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
    persistSourceAuthoritySecurityViolation(rawUrl, "provider_host_not_allowed", provider);
    throw new Error(`Source provider URL host is not allowed for ${provider}.`);
  }
}

function redirectedUrl(currentUrl: string, response: Response): string | null {
  if (!REDIRECT_STATUSES.has(response.status)) return null;
  const location = response.headers.get("location");
  if (!location) {
    throw new Error(`Source provider returned HTTP ${response.status} without a Location header.`);
  }
  return new URL(location, currentUrl).toString();
}

async function fetchWithValidatedRedirects(url: string, options: ResilientFetchOptions, signal: AbortSignal): Promise<Response> {
  let currentUrl = url;
  for (let redirectHop = 0; redirectHop <= MAX_REDIRECT_HOPS; redirectHop += 1) {
    assertProviderUrlAllowed(options.provider, currentUrl);
    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal,
      headers: {
        accept: options.accept,
        ...(options.userAgent ? { "user-agent": options.userAgent } : {})
      }
    });
    const nextUrl = redirectedUrl(currentUrl, response);
    if (!nextUrl) return response;
    assertProviderUrlAllowed(options.provider, nextUrl);
    currentUrl = nextUrl;
  }

  throw new Error("Source provider exceeded maximum redirect hops.");
}

export function getSourceProviderHealth(): SourceProviderHealth[] {
  return Array.from(providerHealth.values()).map((health) => ({ ...health }));
}

export function getSourceProviderRuntimeState(): ProviderRuntimeState[] {
  return Array.from(providerRuntimeState.values()).map((state) => ({ ...state }));
}

export async function loadPersistentSourceProviderHealth(): Promise<SourceProviderHealth[]> {
  if (!providerRuntimeStore) return getSourceProviderHealth();
  const persisted = await providerRuntimeStore.list();
  providerHealth.clear();
  providerRuntimeState.clear();
  for (const state of persisted) {
    providerRuntimeState.set(state.provider, { ...state });
    providerHealth.set(state.provider, stateToHealth(state));
  }
  runtimeInitialized = true;
  return getSourceProviderHealth();
}

function initializeSourceAuthorityRuntime(): Promise<SourceProviderHealth[]> {
  if (!runtimeInitializationPromise) {
    if (providerRuntimeStore === providerRuntimeStateRepository && !config.databaseUrl) {
      runtimeInitialized = true;
      runtimeInitializationPromise = Promise.resolve(getSourceProviderHealth());
      return runtimeInitializationPromise;
    }
    runtimeInitializationPromise = loadPersistentSourceProviderHealth().catch((error) => {
      console.error(
        JSON.stringify({
          level: "error",
          component: "source_provider_resilience",
          message: "Source Authority runtime initialization failed.",
          error: error instanceof Error ? error.message : String(error)
        })
      );
      runtimeInitialized = true;
      return getSourceProviderHealth();
    });
  }
  return runtimeInitializationPromise;
}

export async function ensureSourceAuthorityRuntimeInitialized(): Promise<SourceProviderHealth[]> {
  return initializeSourceAuthorityRuntime();
}

export function resetSourceProviderHealth(): void {
  providerHealth.clear();
  providerRuntimeState.clear();
}

export function resetSourceAuthorityRuntimeForTests(): void {
  providerHealth.clear();
  providerRuntimeState.clear();
  runtimeInitializationPromise = null;
  runtimeInitialized = false;
}

export function setSourceProviderRuntimeStoreForTests(
  store: {
    list(): Promise<ProviderRuntimeState[]>;
    record(update: ProviderRuntimeStateUpdate): Promise<ProviderRuntimeState>;
  } | null
): void {
  providerRuntimeStore = store;
  runtimeInitializationPromise = null;
  runtimeInitialized = false;
}

export function sourceAuthorityRuntimeInitialized(): boolean {
  return runtimeInitialized;
}

export async function providerInCooldown(provider: SourceAuthorityProvider): Promise<boolean> {
  await ensureSourceAuthorityRuntimeInitialized();
  const cooldownUntil = healthFor(provider).cooldownUntil;
  return typeof cooldownUntil === "number" && cooldownUntil > Date.now();
}

export async function resilientFetch(url: string, options: ResilientFetchOptions): Promise<Response> {
  await ensureSourceAuthorityRuntimeInitialized();
  assertProviderUrlAllowed(options.provider, url);
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetchWithValidatedRedirects(url, options, controller.signal);
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

initializeSourceAuthorityRuntime();
