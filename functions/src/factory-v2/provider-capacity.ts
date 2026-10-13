/**
 * Provider-capacity control is deliberately independent of historical
 * acquisition semantics.  It serializes admission for a model/location pair,
 * records every transport attempt, and fails closed when the run cannot make
 * progress inside its sealed deadline.
 */
export type ProviderFailureClass = "TRANSIENT_CAPACITY" | "RATE_LIMIT" | "QUOTA_EXHAUSTED" | "REGIONAL_CAPACITY" | "PROVIDER_TIMEOUT" | "PROVIDER_INTERNAL" | "AUTHENTICATION" | "INVALID_REQUEST" | "UNKNOWN_PROVIDER_FAILURE";
export type ProviderCircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
export const PROVIDER_CAPACITY_POLICY_VERSION = "vertex-capacity-control.1" as const;

export type ProviderAttemptTelemetry = {
  logicalOperationId: string; runId: string; topicId: string; stage: string;
  model: string; location: string; project: string; timestamp: string;
  attempt: number; latencyMs: number; inputTokens: number | null; outputTokens: number | null;
  httpStatus: number | null; canonicalCode: string | null; requestId: string | null;
  retryAfterMs: number | null; classification: ProviderFailureClass | null;
  calculatedBackoffMs: number | null; circuitState: ProviderCircuitState; cumulativeElapsedMs: number;
};

export type ProviderCapacityPolicy = {
  maximumConcurrentOperations: number; maximumAttempts: number; minimumBackoffMs: number;
  maximumBackoffMs: number; maximumRetryTimeMs: number; circuitFailureThreshold: number; circuitCooldownMs: number;
};

export const DEFAULT_PROVIDER_CAPACITY_POLICY: ProviderCapacityPolicy = {
  maximumConcurrentOperations: 1, maximumAttempts: 3, minimumBackoffMs: 1_000,
  maximumBackoffMs: 15_000, maximumRetryTimeMs: 45_000, circuitFailureThreshold: 2, circuitCooldownMs: 15_000
};

type SharedState = { active: number; failures: number; state: ProviderCircuitState; openedAt: number | null; probeActive: boolean };
const stateByProvider = new Map<string, SharedState>();
const shared = (key: string): SharedState => {
  const current = stateByProvider.get(key);
  if (current) return current;
  const created: SharedState = { active: 0, failures: 0, state: "CLOSED", openedAt: null, probeActive: false };
  stateByProvider.set(key, created);
  return created;
};

const numeric = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : null;
const field = (error: unknown, key: string): unknown => error && typeof error === "object" ? (error as Record<string, unknown>)[key] : undefined;
const nested = (error: unknown, key: string): unknown => field(field(error, "error"), key) ?? field(error, key);

export function classifyProviderFailure(error: unknown): { classification: ProviderFailureClass; httpStatus: number | null; canonicalCode: string | null; retryAfterMs: number | null; requestId: string | null } {
  const status = numeric(nested(error, "status")) ?? numeric(nested(error, "code"));
  const canonical = typeof nested(error, "status") === "string" ? String(nested(error, "status")) : typeof nested(error, "code") === "string" ? String(nested(error, "code")) : null;
  const message = [field(error, "message"), nested(error, "message")].filter((value): value is string => typeof value === "string").join(" ").toUpperCase();
  const headers = field(error, "headers");
  const retryAfterRaw = headers && typeof headers === "object" ? (headers as Record<string, unknown>)["retry-after"] ?? (headers as Record<string, unknown>)["Retry-After"] : undefined;
  const retryAfterMs = typeof retryAfterRaw === "number" ? Math.max(0, retryAfterRaw * 1_000) : typeof retryAfterRaw === "string" && /^\d+(?:\.\d+)?$/u.test(retryAfterRaw) ? Math.max(0, Number(retryAfterRaw) * 1_000) : null;
  if (status === 401 || status === 403 || /UNAUTHENTICATED|PERMISSION_DENIED/u.test(message)) return { classification: "AUTHENTICATION", httpStatus: status, canonicalCode: canonical, retryAfterMs, requestId: null };
  if (status === 400 || /INVALID_ARGUMENT|FAILED_PRECONDITION/u.test(message)) return { classification: "INVALID_REQUEST", httpStatus: status, canonicalCode: canonical, retryAfterMs, requestId: null };
  if (status === 408 || status === 504 || /TIMEOUT|DEADLINE_EXCEEDED/u.test(message)) return { classification: "PROVIDER_TIMEOUT", httpStatus: status, canonicalCode: canonical, retryAfterMs, requestId: null };
  if (status === 500 || status === 502 || status === 503 || /INTERNAL|UNAVAILABLE/u.test(message)) return { classification: "PROVIDER_INTERNAL", httpStatus: status, canonicalCode: canonical, retryAfterMs, requestId: null };
  if (status === 429 || /RESOURCE_EXHAUSTED/u.test(message)) {
    if (/QUOTA|LIMIT EXCEEDED/u.test(message)) return { classification: "QUOTA_EXHAUSTED", httpStatus: status, canonicalCode: canonical, retryAfterMs, requestId: null };
    if (/REGION|LOCATION/u.test(message)) return { classification: "REGIONAL_CAPACITY", httpStatus: status, canonicalCode: canonical, retryAfterMs, requestId: null };
    if (/RATE LIMIT|REQUESTS PER MINUTE/u.test(message)) return { classification: "RATE_LIMIT", httpStatus: status, canonicalCode: canonical, retryAfterMs, requestId: null };
    return { classification: "TRANSIENT_CAPACITY", httpStatus: status, canonicalCode: canonical, retryAfterMs, requestId: null };
  }
  return { classification: "UNKNOWN_PROVIDER_FAILURE", httpStatus: status, canonicalCode: canonical, retryAfterMs, requestId: null };
}

export class ProviderCapacityError extends Error {
  constructor(readonly classification: ProviderFailureClass, readonly telemetry: ProviderAttemptTelemetry[], options?: ErrorOptions) {
    super(`PROVIDER_CAPACITY_FAILURE:${classification}`, options); this.name = "ProviderCapacityError";
  }
}

export class ProviderCapacityController {
  private readonly state: SharedState;
  readonly telemetry: ProviderAttemptTelemetry[] = [];
  constructor(readonly input: { runId: string; topicId: string; project: string; model: string; location: string; policy?: ProviderCapacityPolicy; now?: () => number; sleep?: (ms: number) => Promise<void>; random?: () => number }) {
    this.input.policy = input.policy || DEFAULT_PROVIDER_CAPACITY_POLICY;
    this.input.now = input.now || Date.now;
    this.input.sleep = input.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.input.random = input.random || Math.random;
    this.state = shared(`${input.project}:${input.model}:${input.location}`);
  }
  private get policy(): ProviderCapacityPolicy { return this.input.policy!; }
  private get now(): () => number { return this.input.now!; }
  private get sleep(): (ms: number) => Promise<void> { return this.input.sleep!; }
  private get random(): () => number { return this.input.random!; }
  private retryable(value: ProviderFailureClass): boolean { return ["TRANSIENT_CAPACITY", "RATE_LIMIT", "PROVIDER_TIMEOUT", "PROVIDER_INTERNAL"].includes(value); }
  private async waitForAdmission(deadlineAt: number): Promise<void> {
    while (true) {
      const now = this.now();
      if (now >= deadlineAt) throw new ProviderCapacityError("PROVIDER_TIMEOUT", this.telemetry);
      if (this.state.state === "OPEN") {
        const untilProbe = Math.max(0, (this.state.openedAt || now) + this.policy.circuitCooldownMs - now);
        if (untilProbe > 0) { await this.sleep(Math.min(untilProbe, deadlineAt - now)); continue; }
        if (this.state.probeActive) { await this.sleep(Math.min(this.policy.minimumBackoffMs, deadlineAt - now)); continue; }
        this.state.state = "HALF_OPEN"; this.state.probeActive = true;
      }
      if (this.state.active < this.policy.maximumConcurrentOperations) { this.state.active += 1; return; }
      await this.sleep(Math.min(this.policy.minimumBackoffMs, deadlineAt - now));
    }
  }
  private release(success: boolean, capacityFailure: boolean): void {
    this.state.active = Math.max(0, this.state.active - 1);
    if (success) { this.state.failures = 0; this.state.state = "CLOSED"; this.state.openedAt = null; this.state.probeActive = false; return; }
    if (capacityFailure) {
      this.state.failures += 1;
      if (this.state.state === "HALF_OPEN" || this.state.failures >= this.policy.circuitFailureThreshold) { this.state.state = "OPEN"; this.state.openedAt = this.now(); }
    }
    this.state.probeActive = false;
  }
  async execute<T>(input: { logicalOperationId: string; stage: string; deadlineAt: number; run: () => Promise<T> }): Promise<T> {
    const begun = this.now(); let lastError: unknown;
    for (let attempt = 1; attempt <= this.policy.maximumAttempts; attempt += 1) {
      await this.waitForAdmission(input.deadlineAt);
      const started = this.now();
      try {
        const value = await input.run();
        this.telemetry.push({ logicalOperationId: input.logicalOperationId, runId: this.input.runId, topicId: this.input.topicId, stage: input.stage, model: this.input.model, location: this.input.location, project: this.input.project, timestamp: new Date(started).toISOString(), attempt, latencyMs: this.now() - started, inputTokens: null, outputTokens: null, httpStatus: null, canonicalCode: null, requestId: null, retryAfterMs: null, classification: null, calculatedBackoffMs: null, circuitState: this.state.state, cumulativeElapsedMs: this.now() - begun });
        this.release(true, false); return value;
      } catch (error) {
        lastError = error;
        const failure = classifyProviderFailure(error);
        const retryable = this.retryable(failure.classification) && attempt < this.policy.maximumAttempts;
        const exponentialCap = Math.min(this.policy.maximumBackoffMs, this.policy.minimumBackoffMs * 2 ** (attempt - 1));
        const calculatedBackoffMs = retryable ? Math.max(failure.retryAfterMs || 0, Math.floor(this.random() * (exponentialCap + 1))) : null;
        this.telemetry.push({ logicalOperationId: input.logicalOperationId, runId: this.input.runId, topicId: this.input.topicId, stage: input.stage, model: this.input.model, location: this.input.location, project: this.input.project, timestamp: new Date(started).toISOString(), attempt, latencyMs: this.now() - started, inputTokens: null, outputTokens: null, httpStatus: failure.httpStatus, canonicalCode: failure.canonicalCode, requestId: failure.requestId, retryAfterMs: failure.retryAfterMs, classification: failure.classification, calculatedBackoffMs, circuitState: this.state.state, cumulativeElapsedMs: this.now() - begun });
        this.release(false, ["TRANSIENT_CAPACITY", "RATE_LIMIT", "REGIONAL_CAPACITY", "QUOTA_EXHAUSTED"].includes(failure.classification));
        if (!retryable || calculatedBackoffMs === null || this.now() + calculatedBackoffMs > input.deadlineAt || this.now() - begun + calculatedBackoffMs > this.policy.maximumRetryTimeMs) throw new ProviderCapacityError(failure.classification, this.telemetry, { cause: error });
        await this.sleep(calculatedBackoffMs);
      }
    }
    throw new ProviderCapacityError(classifyProviderFailure(lastError).classification, this.telemetry, { cause: lastError });
  }
}
