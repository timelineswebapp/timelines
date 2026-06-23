import "@/src/server/operations/environment";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { closeSql, getWriteSql } from "@/src/server/db/client";
import { migrationLedgerSql, validateMigrationPlan, type MigrationFile } from "@/src/server/operations/migrations";

async function loadMigrations(): Promise<MigrationFile[]> {
  const files = (await readdir("db/migrations")).filter((file) => file.endsWith(".sql")).sort();
  return Promise.all(files.map(async (file) => ({ id: file.replace(/\.sql$/, ""), path: join("db/migrations", file), sql: await readFile(join("db/migrations", file), "utf8") })));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const sql = getWriteSql("running authoritative migrations");
  const migrations = await loadMigrations();
  const rollbackIds = new Set((await readdir("db/rollbacks").catch(() => [])).filter((file) => file.endsWith(".sql")).map((file) => file.replace(/\.sql$/, "")));
  const rollbackRequiredMigrations = migrations.filter((migration) => migration.id >= "20260630");
  const validation = validateMigrationPlan(rollbackRequiredMigrations, rollbackIds);
  if (!validation.ok) throw new Error(`Migration plan validation failed: ${JSON.stringify(validation)}`);
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, component: "migration_runner", dryRun, migrations: migrations.map((migration) => migration.id) }));
    await closeSql();
    return;
  }

  await sql.unsafe(migrationLedgerSql());
  for (const migration of migrations) {
    const checksum = createHash("sha256").update(migration.sql).digest("hex");
    const existing = await sql<Array<{ migration_id: string }>>`SELECT migration_id FROM operational_migration_ledger WHERE migration_id = ${migration.id}`;
    if (existing.length > 0) continue;
    const started = Date.now();
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration.sql);
      await transaction.unsafe(
        "INSERT INTO operational_migration_ledger (migration_id, checksum, applied_by, execution_ms) VALUES ($1, $2, $3, $4)",
        [migration.id, checksum, process.env.USER || "operator", Date.now() - started]
      );
    });
    console.log(JSON.stringify({ ok: true, component: "migration_runner", applied: migration.id }));
  }
  await closeSql();
}

main().catch(async (error) => {
  await closeSql();
  console.error(JSON.stringify({ ok: false, component: "migration_runner", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
