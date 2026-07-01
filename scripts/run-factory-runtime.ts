import "@/src/server/operations/environment";
import { closeSql } from "@/src/server/db/client";
import { getFactoryRuntimeProvider } from "@/src/server/factory/runtime-providers";
import { FactoryDispatcher } from "@/src/server/services/factory-dispatcher";

const component = "factory_runtime";

function log(level: "info" | "error", event: string, details: Record<string, unknown> = {}): void {
  console[level](JSON.stringify({
    level,
    component,
    event,
    timestamp: new Date().toISOString(),
    ...details
  }));
}

function requireEnvironmentUrl(name: "DATABASE_URL" | "OLLAMA_BASE_URL"): URL {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured for Factory runtime execution.`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (name === "DATABASE_URL" && !["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
  }
  if (name === "OLLAMA_BASE_URL" && !["http:", "https:"].includes(url.protocol)) {
    throw new Error("OLLAMA_BASE_URL must use the http or https protocol.");
  }
  return url;
}

async function main(): Promise<void> {
  const databaseUrl = requireEnvironmentUrl("DATABASE_URL");
  const ollamaBaseUrl = requireEnvironmentUrl("OLLAMA_BASE_URL");
  log("info", "startup", {
    databaseHost: databaseUrl.hostname,
    ollamaHost: ollamaBaseUrl.host
  });

  const provider = getFactoryRuntimeProvider("qwen14");
  const health = await provider.health();
  log(health.ok ? "info" : "error", "provider_health_verified", {
    ok: health.ok,
    providerKey: health.providerKey,
    modelName: health.modelName,
    diagnostics: health.diagnostics
  });
  if (!health.ok) {
    throw new Error(`Factory runtime provider health verification failed for ${health.modelName}.`);
  }

  const result = await new FactoryDispatcher().runCycle();
  log("info", "cycle_completed", { result });
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    log("error", "runtime_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  })
  .finally(async () => {
    try {
      await closeSql();
      log("info", "shutdown_completed", { databaseClosed: true });
    } catch (error) {
      process.exitCode = 1;
      log("error", "shutdown_failed", {
        databaseClosed: false,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
