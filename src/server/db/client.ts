import postgres, { type Sql } from "postgres";
import { config, assertDatabaseConfigured } from "@/src/lib/config";
import { ApiError } from "@/src/server/api/responses";

let sqlInstance: Sql | null = null;
let hasWarnedFallback = false;

export function getSql(): Sql | null {
  if (sqlInstance) {
    return sqlInstance;
  }

  if (!config.databaseUrl) {
    if (!config.isProduction && !hasWarnedFallback) {
      hasWarnedFallback = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          component: "db",
          message: "DATABASE_URL is not configured. Falling back to deterministic sample data."
        })
      );
    }

    return null;
  }

  assertDatabaseConfigured();

  sqlInstance = postgres(config.databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true
  });

  return sqlInstance;
}

export function getWriteSql(operation: string): Sql {
  const sql = getSql();
  if (!sql) {
    throw new ApiError(503, "DATABASE_UNAVAILABLE", `DATABASE_URL missing - ${operation} cannot persist.`);
  }

  return sql;
}

export async function closeSql(): Promise<void> {
  if (!sqlInstance) {
    return;
  }

  await sqlInstance.end({ timeout: 5 });
  sqlInstance = null;
}
