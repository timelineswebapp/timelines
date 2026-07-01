import "@/src/server/operations/environment";
import postgres from "postgres";
import {
  assertNonProductionEnvironment,
  hasResetConfirmation,
  resolveOperationsEnvironment,
  runFactoryReset
} from "./factory-reset-core";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || "";
  const database = assertNonProductionEnvironment(process.env, databaseUrl);
  const environment = resolveOperationsEnvironment(process.env);
  const databaseName = decodeURIComponent(database.pathname.replace(/^\/+/, ""));
  console.log(
    `Factory Reset\n\nTarget Database:\n${database.hostname}/${databaseName}` +
    `\n\nEnvironment:\n${environment}\n\nSafety Status:\nPASS`
  );

  const confirmed = hasResetConfirmation(process.argv.slice(2));
  if (!confirmed) {
    console.log(
      "\n\nThis is a destructive operation.\n\nRun:\n\n" +
      "npm run factory:reset -- --confirm TIMELINES"
    );
    return;
  }

  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: true });
  try {
    const results = await runFactoryReset(sql);
    for (const [group, count] of Object.entries(results)) {
      console.log(`Clearing ${group}...`);
      console.log(`✓ (${count})`);
    }
    console.log("\nDatabase integrity...\nPASS\n\nFactory reset completed.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
