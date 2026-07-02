export type FactoryRuntimeProviderKey = "qwen14";

export type FactoryRuntimeProviderRequest = {
  prompt: string;
  input: Record<string, unknown>;
  configuration: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  timeoutMs?: number;
};

export type FactoryRuntimeProviderResponse = {
  providerKey: FactoryRuntimeProviderKey;
  modelName: string;
  output: Record<string, unknown>;
  diagnostics: Record<string, unknown>;
};

export type FactoryRuntimeProvider = {
  providerKey: FactoryRuntimeProviderKey;
  modelName: string;
  health(): Promise<{ ok: boolean; providerKey: FactoryRuntimeProviderKey; modelName: string; diagnostics: Record<string, unknown> }>;
  execute(request: FactoryRuntimeProviderRequest): Promise<FactoryRuntimeProviderResponse>;
};

const defaultOllamaBaseUrl = "http://127.0.0.1:11434";
const defaultQwen14Model = "qwen2.5:14b";
const defaultFactoryQwenTimeoutMs = 120000;

type ProviderLease = { queueWaitMs: number; release(): void };

export class ProviderExecutionLimiter {
  private active = 0;
  private starts: number[] = [];
  private queue: Array<{ queuedAt: number; resolve: (lease: ProviderLease) => void; reject: (error: Error) => void }> = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly concurrency: number, private readonly requestsPerMinute: number, private readonly maxQueue = 100) {}

  acquire(): Promise<ProviderLease> {
    if (this.queue.length >= this.maxQueue) return Promise.reject(new Error("PROVIDER_THROTTLED: provider execution queue is full."));
    return new Promise((resolve, reject) => {
      this.queue.push({ queuedAt: Date.now(), resolve, reject });
      this.drain();
    });
  }

  private drain() {
    const now = Date.now();
    this.starts = this.starts.filter((value) => value > now - 60_000);
    while (this.active < this.concurrency && this.starts.length < this.requestsPerMinute && this.queue.length) {
      const next = this.queue.shift()!;
      this.active += 1;
      this.starts.push(Date.now());
      let released = false;
      next.resolve({
        queueWaitMs: Date.now() - next.queuedAt,
        release: () => {
          if (released) return;
          released = true;
          this.active -= 1;
          this.drain();
        }
      });
    }
    if (this.queue.length && !this.timer) {
      const delay = Math.max(10, (this.starts[0] || now) + 60_000 - now);
      this.timer = setTimeout(() => { this.timer = null; this.drain(); }, delay);
      this.timer.unref();
    }
  }
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

const localDevelopmentQwenLimiter = new ProviderExecutionLimiter(
  positiveInteger(process.env.QWEN14_MAX_CONCURRENCY, 2, 16),
  positiveInteger(process.env.QWEN14_REQUESTS_PER_MINUTE, 30, 600),
  positiveInteger(process.env.QWEN14_MAX_QUEUE, 100, 1000)
);

export class FactoryRuntimeProviderError extends Error {
  diagnostics: Record<string, unknown>;
  override cause?: unknown;

  constructor(message: string, diagnostics: Record<string, unknown>, cause?: unknown) {
    super(message);
    this.name = "FactoryRuntimeProviderError";
    this.diagnostics = diagnostics;
    this.cause = cause;
    if (cause instanceof Error && cause.stack && !this.stack?.includes("Caused by:")) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export class FactoryRuntimeProviderTimeoutError extends FactoryRuntimeProviderError {
  constructor(message: string, diagnostics: Record<string, unknown>, cause?: unknown) {
    super(message, diagnostics, cause);
    this.name = "FactoryRuntimeProviderTimeoutError";
  }
}

export class FactoryRuntimeProviderOutputTruncatedError extends FactoryRuntimeProviderError {
  code = "MODEL_OUTPUT_TRUNCATED";

  constructor(message: string, diagnostics: Record<string, unknown>, cause?: unknown) {
    super(message, diagnostics, cause);
    this.name = "FactoryRuntimeProviderOutputTruncatedError";
  }
}

function diagnostics(startedAt: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: "ollama",
    execution: "service_mediated",
    generationEnabled: true,
    durationMs: Date.now() - startedAt,
    ...extra
  };
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Some local models still wrap JSON despite format=json. Fall through to bounded extraction.
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Qwen14 provider returned no JSON object.");
  }
  const parsed = JSON.parse(trimmed.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Qwen14 provider returned malformed JSON.");
  }
  const object = parsed as Record<string, unknown>;
  if (Object.keys(object).length === 0) {
    throw new Error("Qwen14 provider returned an empty JSON object.");
  }
  return object;
}

function errorProperty(error: unknown, property: string): unknown {
  return error && typeof error === "object" && property in error
    ? (error as Record<string, unknown>)[property]
    : undefined;
}

function serializeCause(error: unknown, depth = 0): Record<string, unknown> | null {
  if (!error || depth > 6) return null;
  if (error instanceof Error || typeof error === "object") {
    const cause = errorProperty(error, "cause");
    return {
      name: error instanceof Error ? error.name : errorProperty(error, "name") ?? null,
      message: error instanceof Error ? error.message : errorProperty(error, "message") ?? String(error),
      code: errorProperty(error, "code") ?? null,
      errno: errorProperty(error, "errno") ?? null,
      syscall: errorProperty(error, "syscall") ?? null,
      hostname: errorProperty(error, "hostname") ?? null,
      address: errorProperty(error, "address") ?? null,
      port: errorProperty(error, "port") ?? null,
      cause: serializeCause(cause, depth + 1)
    };
  }
  return { name: null, message: String(error), cause: null };
}

function firstCauseValue(error: unknown, property: string): unknown {
  let current: unknown = error;
  for (let depth = 0; current && depth <= 6; depth += 1) {
    const value = errorProperty(current, property);
    if (value !== undefined && value !== null) return value;
    current = errorProperty(current, "cause");
  }
  return null;
}

function headersObject(headers?: Headers): Record<string, string> | null {
  if (!headers) return null;
  return Object.fromEntries(headers.entries());
}

function preview(raw: string | null | undefined, length = 500): string | null {
  if (typeof raw !== "string") return null;
  return raw.slice(0, length);
}

function promptTokenEstimate(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}

function compactSchemaInstruction(schema: Record<string, unknown> | undefined): string {
  const workerKey = typeof schema?.workerKey === "string" ? schema.workerKey : "factory_worker";
  if (workerKey === "research_worker_compact") {
    return "research_worker compact output required keys: summary, confidence, boundary, claims, candidates. Claims and candidates must reference supporting evidenceRecordIds only. Do not emit authority metadata, citation metadata, lineage metadata, or retrieval metadata.";
  }
  if ([
    "object_extraction_worker",
    "milestone_extraction_worker",
    "participation_extraction_worker",
    "relationship_extraction_worker",
    "context_enrichment_worker"
  ].includes(workerKey)) {
    return `${workerKey} compact output required keys: summary, confidence, boundary, candidates. Each candidate requires title, objectType, payload, evidenceRecordIds. Copy only supplied evidenceRecordIds verbatim. Do not emit sources, citations, URLs, publisher data, or provenance metadata.`;
  }
  return `${workerKey} output object required keys: summary, confidence, boundary, sources, evidence, candidates. Arrays sources/evidence/candidates must be non-empty unless worker is validation-only. Evidence items require claim and citations[]. Candidate items require title, objectType, payload, evidence, sources.`;
}

export function resolveFactoryQwenTimeoutMs(requestTimeoutMs: number | undefined): number {
  const configured = process.env.FACTORY_QWEN_TIMEOUT_MS;
  if (configured) {
    const parsed = Number(configured);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return requestTimeoutMs || defaultFactoryQwenTimeoutMs;
}

function hostOnly(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return "invalid_ollama_base_url";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

const qwen14Provider: FactoryRuntimeProvider = {
  providerKey: "qwen14",
  modelName: process.env.QWEN14_MODEL || defaultQwen14Model,

  async health() {
    const startedAt = Date.now();
    const baseUrl = process.env.OLLAMA_BASE_URL || defaultOllamaBaseUrl;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
      const payload = response.ok ? ((await response.json()) as { models?: Array<{ name?: string }> }) : null;
      const modelAvailable = payload?.models?.some((model) => model.name === this.modelName) ?? false;
      return {
        ok: response.ok && modelAvailable,
        providerKey: "qwen14",
        modelName: this.modelName,
        diagnostics: diagnostics(startedAt, {
          baseUrl,
          status: response.status,
          modelAvailable
        })
      };
    } catch (error) {
      return {
        ok: false,
        providerKey: "qwen14",
        modelName: this.modelName,
        diagnostics: diagnostics(startedAt, {
          baseUrl,
          failureClass: "provider_health_check_failed",
          message: error instanceof Error ? error.message : "Unknown Ollama health failure."
        })
      };
    } finally {
      clearTimeout(timeout);
    }
  },

  async execute(request) {
    const timeoutMs = resolveFactoryQwenTimeoutMs(request.timeoutMs);
    const ownerId = `qwen14-${randomUUID()}`;
    const durableCoordination = Boolean(process.env.DATABASE_URL);
    const lease = durableCoordination
      ? await providerCoordinationRepository.acquire({
          providerKey: "qwen14",
          ownerId,
          maxConcurrency: positiveInteger(process.env.QWEN14_MAX_CONCURRENCY, 2, 16),
          requestsPerMinute: positiveInteger(process.env.QWEN14_REQUESTS_PER_MINUTE, 30, 600),
          leaseSeconds: Math.ceil(timeoutMs / 1000) + 30,
          waitTimeoutMs: Math.min(timeoutMs, 60_000)
        })
      : await localDevelopmentQwenLimiter.acquire();
    const startedAt = Date.now();
    const baseUrl = process.env.OLLAMA_BASE_URL || defaultOllamaBaseUrl;
    const requestUrl = `${baseUrl}/api/generate`;
    const method = "POST";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let fetchReachedResponseParsing = false;
    const prompt = request.configuration.compilerPrompt === "object_extraction"
      ? request.prompt
      : `/no_think
You are TiMELiNES Factory historical intelligence.
Return one complete JSON object only. Do not return {}. Do not include markdown.
The JSON object must contain all required fields and non-empty arrays requested by the schema.
If a field is uncertain, include a conservative value with source-grounded evidence instead of omitting it.

${request.prompt}

Input JSON:
${JSON.stringify(request.input)}

Schema contract:
${compactSchemaInstruction((request.outputSchema || request.configuration.outputSchema) as Record<string, unknown> | undefined)}`;
    const maxOutputTokens = typeof request.configuration.maxOutputTokens === "number" ? request.configuration.maxOutputTokens : undefined;
    const structuredOutputSchema = request.outputSchema || (
      request.configuration.outputSchema &&
      typeof request.configuration.outputSchema === "object" &&
      !Array.isArray(request.configuration.outputSchema)
        ? request.configuration.outputSchema as Record<string, unknown>
        : undefined
    );
    const requestBody = JSON.stringify({
      model: this.modelName,
      prompt,
      stream: false,
      ...(structuredOutputSchema ? { format: structuredOutputSchema } : {}),
      options: {
        temperature: typeof request.configuration.temperature === "number" ? request.configuration.temperature : 0.1,
        num_predict: maxOutputTokens
      }
    });
    const baseDiagnostics = (failureClass: string, extra: Record<string, unknown> = {}) => diagnostics(startedAt, {
      providerKey: "qwen14",
      modelName: this.modelName,
      requestUrl,
      method,
      bodyBytes: Buffer.byteLength(requestBody, "utf8"),
      promptChars: prompt.length,
      estimatedPromptTokens: promptTokenEstimate(prompt),
      maxOutputTokens: maxOutputTokens ?? null,
      timeoutMs,
      durationMs: Date.now() - startedAt,
      failureClass,
      transportCause: null,
      systemErrorCode: null,
      errno: null,
      syscall: null,
      hostname: null,
      address: null,
      port: null,
      httpStatus: null,
      contentType: null,
      responsePreview: null,
      ...extra
    });

    try {
      const response = await fetch(requestUrl, {
        method,
        headers: { "content-type": "application/json" },
        body: requestBody,
        signal: controller.signal
      });
      const responseText = await response.text();
      const responsePreview = preview(responseText);
      const responseDiagnostics = {
        httpStatus: response.status,
        headers: headersObject(response.headers),
        contentType: response.headers.get("content-type"),
        responsePreview
      };
      if (!response.ok) {
        throw new FactoryRuntimeProviderError(`Ollama Qwen14 request failed with status ${response.status}.`, baseDiagnostics("HTTP_FAILURE", responseDiagnostics));
      }
      fetchReachedResponseParsing = true;
      let payload: {
        response?: string;
        done_reason?: string;
        prompt_eval_count?: number;
        eval_count?: number;
        total_duration?: number;
        load_duration?: number;
        prompt_eval_duration?: number;
        eval_duration?: number;
      };
      try {
        payload = JSON.parse(responseText) as typeof payload;
      } catch (error) {
        throw new FactoryRuntimeProviderError("Ollama Qwen14 response could not be parsed as JSON.", baseDiagnostics("PARSE_FAILURE", responseDiagnostics), error);
      }
      if (typeof payload.response !== "string" || payload.response.trim().length === 0) {
        throw new FactoryRuntimeProviderError("Ollama Qwen14 returned an empty response.", baseDiagnostics("PARSE_FAILURE", responseDiagnostics));
      }
      if (payload.done_reason === "length") {
        throw new FactoryRuntimeProviderOutputTruncatedError("MODEL_OUTPUT_TRUNCATED: Ollama stopped generation because the output token limit was reached.", baseDiagnostics("MODEL_OUTPUT_TRUNCATED", {
          code: "MODEL_OUTPUT_TRUNCATED",
          promptTokens: payload.prompt_eval_count ?? null,
          completionTokens: payload.eval_count ?? null,
          totalTokens: (payload.prompt_eval_count ?? 0) + (payload.eval_count ?? 0),
          rawResponsePreview: payload.response.slice(0, 2000),
          ...responseDiagnostics
        }));
      }
      let output: Record<string, unknown>;
      try {
        output = extractJsonObject(payload.response);
      } catch (error) {
        throw new FactoryRuntimeProviderError("Ollama Qwen14 response JSON object could not be parsed.", baseDiagnostics("PARSE_FAILURE", {
          ...responseDiagnostics,
          rawResponsePreview: payload.response.slice(0, 2000)
        }), error);
      }
      return {
        providerKey: "qwen14",
        modelName: this.modelName,
        output,
        diagnostics: diagnostics(startedAt, {
          providerKey: "qwen14",
          modelName: this.modelName,
          requestUrl,
          method,
          bodyBytes: Buffer.byteLength(requestBody, "utf8"),
          promptChars: prompt.length,
          estimatedPromptTokens: promptTokenEstimate(prompt),
          maxOutputTokens: maxOutputTokens ?? null,
          promptTokens: payload.prompt_eval_count ?? null,
          completionTokens: payload.eval_count ?? null,
          totalTokens: (payload.prompt_eval_count ?? 0) + (payload.eval_count ?? 0),
          ollamaTotalDurationNs: payload.total_duration ?? null,
          ollamaLoadDurationNs: payload.load_duration ?? null,
          ollamaPromptEvalDurationNs: payload.prompt_eval_duration ?? null,
          ollamaEvalDurationNs: payload.eval_duration ?? null,
          rawResponsePreview: payload.response.slice(0, 2000)
        })
      };
    } catch (error) {
      if (error instanceof FactoryRuntimeProviderError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new FactoryRuntimeProviderTimeoutError("Ollama Qwen14 request timed out.", diagnostics(startedAt, {
          ...baseDiagnostics("TRANSPORT_FAILURE", {
            legacyFailureClass: "provider_timeout_failed",
            transportCause: serializeCause(error),
            systemErrorCode: firstCauseValue(error, "code"),
            errno: firstCauseValue(error, "errno"),
            syscall: firstCauseValue(error, "syscall"),
            hostname: firstCauseValue(error, "hostname"),
            address: firstCauseValue(error, "address"),
            port: firstCauseValue(error, "port")
          }),
          providerKey: "qwen14",
          modelName: this.modelName,
          baseUrlHost: hostOnly(baseUrl),
          timeoutMs,
          providerQueueWaitMs: lease.queueWaitMs,
          elapsedMs: Date.now() - startedAt,
          attempt: typeof request.configuration.attempt === "number" ? request.configuration.attempt : null,
          fetchReachedResponseParsing
        }), error);
      }
      throw new FactoryRuntimeProviderError("Ollama Qwen14 transport request failed.", baseDiagnostics("TRANSPORT_FAILURE", {
        transportCause: serializeCause(error),
        systemErrorCode: firstCauseValue(error, "code"),
        errno: firstCauseValue(error, "errno"),
        syscall: firstCauseValue(error, "syscall"),
        hostname: firstCauseValue(error, "hostname"),
        address: firstCauseValue(error, "address"),
        port: firstCauseValue(error, "port"),
        fetchReachedResponseParsing
      }), error);
    } finally {
      clearTimeout(timeout);
      if (durableCoordination && "leaseId" in lease) {
        try {
          await providerCoordinationRepository.release(lease.leaseId, ownerId);
        } catch (error) {
          console.error(JSON.stringify({
            level: "error", component: "provider_coordination", event: "lease_release_failed",
            providerKey: "qwen14", leaseId: lease.leaseId,
            message: error instanceof Error ? error.message : "Unknown provider lease release failure"
          }));
        }
      } else if ("release" in lease) {
        lease.release();
      }
    }
  }
};

const providers: Record<FactoryRuntimeProviderKey, FactoryRuntimeProvider> = {
  qwen14: qwen14Provider
};

export function getFactoryRuntimeProvider(providerKey: string): FactoryRuntimeProvider {
  const provider = providers[providerKey as FactoryRuntimeProviderKey];
  if (!provider) {
    throw new Error(`Unknown Factory runtime provider: ${providerKey}`);
  }
  return provider;
}

export function listFactoryRuntimeProviders(): FactoryRuntimeProvider[] {
  return Object.values(providers);
}
import { randomUUID } from "node:crypto";
import { providerCoordinationRepository } from "@/src/server/repositories/provider-coordination-repository";
