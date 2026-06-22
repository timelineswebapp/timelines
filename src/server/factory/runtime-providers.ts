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

function compactSchemaInstruction(schema: Record<string, unknown> | undefined): string {
  const workerKey = typeof schema?.workerKey === "string" ? schema.workerKey : "factory_worker";
  return `${workerKey} output object required keys: summary, confidence, boundary, sources, evidence, candidates. Arrays sources/evidence/candidates must be non-empty unless worker is validation-only. Evidence items require claim and citations[]. Candidate items require title, objectType, payload, evidence, sources.`;
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
    const startedAt = Date.now();
    const baseUrl = process.env.OLLAMA_BASE_URL || defaultOllamaBaseUrl;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs || 120000);
    const prompt = `/no_think
You are TiMELiNES Factory historical intelligence.
Return one complete JSON object only. Do not return {}. Do not include markdown.
The JSON object must contain all required fields and non-empty arrays requested by the schema.
If a field is uncertain, include a conservative value with source-grounded evidence instead of omitting it.

${request.prompt}

Input JSON:
${JSON.stringify(request.input)}

Schema contract:
${compactSchemaInstruction((request.outputSchema || request.configuration.outputSchema) as Record<string, unknown> | undefined)}`;

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.modelName,
          prompt,
          stream: false,
          options: {
            temperature: typeof request.configuration.temperature === "number" ? request.configuration.temperature : 0.1,
            num_predict: typeof request.configuration.maxOutputTokens === "number" ? request.configuration.maxOutputTokens : undefined
          }
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Ollama Qwen14 request failed with status ${response.status}.`);
      }
      const payload = (await response.json()) as {
        response?: string;
        prompt_eval_count?: number;
        eval_count?: number;
        total_duration?: number;
        load_duration?: number;
        prompt_eval_duration?: number;
        eval_duration?: number;
      };
      if (typeof payload.response !== "string" || payload.response.trim().length === 0) {
        throw new Error("Ollama Qwen14 returned an empty response.");
      }
      const output = extractJsonObject(payload.response);
      return {
        providerKey: "qwen14",
        modelName: this.modelName,
        output,
        diagnostics: diagnostics(startedAt, {
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
    } finally {
      clearTimeout(timeout);
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
