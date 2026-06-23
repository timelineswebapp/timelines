import "@/src/server/operations/environment";
import { requiredRecoveryValidationQueries } from "@/src/server/operations/backup-recovery";
import { getWriteSql, closeSql } from "@/src/server/db/client";

async function main(): Promise<void> {
  const sql = getWriteSql("recovery validation");
  const results: Array<{ query: string; count: number }> = [];
  for (const query of requiredRecoveryValidationQueries()) {
    const [row] = await sql.unsafe<Array<{ count: number | string }>>(query);
    results.push({ query, count: Number(row?.count ?? 0) });
  }
  await closeSql();
  console.log(JSON.stringify({ ok: true, component: "recovery_validation", results }));
}

main().catch(async (error) => {
  await closeSql();
  console.error(JSON.stringify({ ok: false, component: "recovery_validation", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
