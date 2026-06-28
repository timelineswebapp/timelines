import "@/src/server/operations/environment";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${String(chunk)}`.slice(-50_000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-20_000); });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${command} exited ${code}: ${stderr}`)));
  });
}

function databaseIdentity(value: string): string {
  const url = new URL(value);
  url.password = "";
  return url.toString();
}

async function main() {
  const productionUrl = process.env.DATABASE_URL;
  const syntheticUrl = process.env.SYNTHETIC_DATABASE_URL;
  if (!productionUrl || !syntheticUrl) throw new Error("DATABASE_URL and SYNTHETIC_DATABASE_URL are required.");
  if (databaseIdentity(productionUrl) === databaseIdentity(syntheticUrl)) {
    throw new Error("Synthetic certification refuses to use the canonical production database.");
  }

  const root = process.env.BACKUP_DIR || "ops/backups";
  const entries = await readdir(root, { withFileTypes: true });
  const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().at(-1);
  if (!latest) throw new Error("Synthetic certification requires a verified backup.");
  const manifest = join(root, latest, "manifest.json");
  await run("npm", ["run", "ops:restore", "--", manifest], { ...process.env, RESTORE_DATABASE_URL: syntheticUrl });
  const output = await run("npm", ["run", "ops:publication:certify"], {
    ...process.env, DATABASE_URL: syntheticUrl, SYNTHETIC_CERTIFICATION: "true"
  });
  console.log(JSON.stringify({
    ok: true,
    component: "synthetic_publication_certification",
    mode: "isolated_disposable_database",
    manifest,
    output
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, component: "synthetic_publication_certification", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
