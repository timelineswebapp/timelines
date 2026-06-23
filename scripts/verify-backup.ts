import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { BackupManifest } from "@/src/server/operations/backup-recovery";
import { validateBackupManifest } from "@/src/server/operations/backup-recovery";

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function main(): Promise<void> {
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error("Usage: tsx scripts/verify-backup.ts <manifest.json>");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest;
  const structural = validateBackupManifest(manifest);
  if (!structural.ok) throw new Error(`Backup manifest is invalid: ${JSON.stringify(structural)}`);

  for (const [path, expectedHash] of Object.entries(manifest.sha256)) {
    const metadata = await stat(path);
    if (!metadata.isFile() || metadata.size === 0) throw new Error(`Backup artifact is empty or missing: ${path}`);
    const actualHash = await sha256(path);
    if (actualHash !== expectedHash) throw new Error(`Backup artifact hash mismatch: ${path}`);
  }

  console.log(JSON.stringify({ ok: true, component: "backup_verification", artifacts: Object.keys(manifest.sha256).length }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, component: "backup_verification", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
