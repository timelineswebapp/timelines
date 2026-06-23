import "@/src/server/operations/environment";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { BackupManifest } from "@/src/server/operations/backup-recovery";

const RESTORE_DATABASE_URL = process.env.RESTORE_DATABASE_URL;

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

async function main(): Promise<void> {
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error("Usage: RESTORE_DATABASE_URL=... tsx scripts/execute-restore.ts <manifest.json>");
  if (!RESTORE_DATABASE_URL) throw new Error("RESTORE_DATABASE_URL is required. Refusing to restore into DATABASE_URL.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest;
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl", "--dbname", RESTORE_DATABASE_URL, manifest.databaseDumpPath]);
  console.log(JSON.stringify({ ok: true, component: "restore_execution", restoredFrom: manifest.databaseDumpPath }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, component: "restore_execution", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
