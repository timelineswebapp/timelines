import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let environmentBootstrapped = false;

function parseEnvironmentLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const separator = normalized.indexOf("=");
  if (separator <= 0) return null;

  const key = normalized.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = normalized.slice(separator + 1).trim();
  const quote = value[0];
  if ((quote === `"` || quote === `'`) && value.endsWith(quote)) {
    value = value.slice(1, -1);
  }

  if (quote === `"`) {
    value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
  }

  return [key, value];
}

function loadEnvironmentFile(path: string, protectedKeys: Set<string>): void {
  if (!existsSync(path)) return;
  const contents = readFileSync(path, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvironmentLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (protectedKeys.has(key)) continue;
    process.env[key] = value;
  }
}

export function bootstrapOperationsEnvironment(): void {
  if (environmentBootstrapped) return;
  environmentBootstrapped = true;

  const protectedKeys = new Set(Object.keys(process.env));
  loadEnvironmentFile(resolve(process.cwd(), ".env"), protectedKeys);
  loadEnvironmentFile(resolve(process.cwd(), ".env.local"), protectedKeys);
}

bootstrapOperationsEnvironment();
