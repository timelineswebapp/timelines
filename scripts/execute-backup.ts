import "@/src/server/operations/environment";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile, copyFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import type { BackupManifest } from "@/src/server/operations/backup-recovery";
import { validateBackupManifest } from "@/src/server/operations/backup-recovery";

const BACKUP_ROOT = resolve(process.env.BACKUP_DIR || "ops/backups");
const DATABASE_URL = process.env.DATABASE_URL;

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

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function copyArtifacts(destination: string): Promise<string[]> {
  const artifactsDir = join(destination, "artifacts");
  await mkdir(artifactsDir, { recursive: true });
  const copied: string[] = [];
  for (const sourceDir of ["data", "docs/operations", "Knowledge"]) {
    const entries = await readdir(sourceDir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const sourcePath = join(entry.path, entry.name);
      const relativePath = sourcePath.replace(/^\.\//, "");
      const targetPath = join(artifactsDir, relativePath);
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
      copied.push(targetPath);
    }
  }
  return copied;
}

async function main(): Promise<void> {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required for backup execution.");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = join(BACKUP_ROOT, stamp);
  await mkdir(destination, { recursive: true });

  const databaseDumpPath = join(destination, "database.dump");
  const schemaPath = join(destination, "schema.sql");
  await run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", databaseDumpPath, DATABASE_URL]);
  await copyFile("db/schema.sql", schemaPath);
  const artifactPaths = await copyArtifacts(destination);

  const paths = [databaseDumpPath, schemaPath, ...artifactPaths];
  const sha: Record<string, string> = {};
  for (const path of paths) {
    const metadata = await stat(path);
    if (!metadata.isFile() || metadata.size === 0) throw new Error(`Backup artifact is empty: ${path}`);
    sha[path] = await sha256(path);
  }

  const manifest: BackupManifest = {
    generatedAt: new Date().toISOString(),
    databaseDumpPath,
    schemaPath,
    artifactPaths,
    sha256: sha
  };
  const verification = validateBackupManifest(manifest);
  if (!verification.ok) throw new Error(`Backup manifest verification failed: ${JSON.stringify(verification)}`);
  await writeFile(join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, backup: destination, artifacts: paths.length }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, component: "backup_execution", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
