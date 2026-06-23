import "@/src/server/operations/environment";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { closeSql, getWriteSql } from "@/src/server/db/client";

async function main(): Promise<void> {
  const migrationId = process.argv[2];
  if (!migrationId || !/^\d{8}_[a-z0-9_]+$/.test(migrationId)) {
    throw new Error("Usage: tsx scripts/run-rollback.ts <migration_id>");
  }
  const sql = getWriteSql("running migration rollback");
  const rollbackSql = await readFile(join("db/rollbacks", `${migrationId}.sql`), "utf8");
  await sql.begin(async (transaction) => {
    await transaction.unsafe(rollbackSql);
    await transaction.unsafe("DELETE FROM operational_migration_ledger WHERE migration_id = $1", [migrationId]);
  });
  await closeSql();
  console.log(JSON.stringify({ ok: true, component: "migration_rollback", rolledBack: migrationId }));
}

main().catch(async (error) => {
  await closeSql();
  console.error(JSON.stringify({ ok: false, component: "migration_rollback", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
