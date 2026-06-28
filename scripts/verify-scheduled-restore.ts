import "@/src/server/operations/environment";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import postgres from "postgres";
import { requiredRecoveryValidationQueries } from "@/src/server/operations/backup-recovery";

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}.`)));
  });
}

async function main() {
  if (!process.env.RESTORE_DATABASE_URL) throw new Error("RESTORE_DATABASE_URL is required for isolated scheduled restore verification.");
  const root = process.env.BACKUP_DIR || "ops/backups";
  const entries = await readdir(root, { withFileTypes: true });
  const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().at(-1);
  if (!latest) throw new Error("No backup exists for scheduled restore verification.");
  const manifest = join(root, latest, "manifest.json");
  await run("npm", ["run", "ops:restore", "--", manifest]);
  const sql = postgres(process.env.RESTORE_DATABASE_URL, { max: 1, connect_timeout: 10 });
  const counts: number[] = [];
  try {
    for (const query of requiredRecoveryValidationQueries()) {
      const [row] = await sql.unsafe<Array<{ count: number | string }>>(query);
      counts.push(Number(row?.count || 0));
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  console.log(JSON.stringify({ ok: true, component: "scheduled_restore_verification", manifest, validationQueryCount: counts.length, counts }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, component: "scheduled_restore_verification", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
