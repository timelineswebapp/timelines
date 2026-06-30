import { AsyncLocalStorage } from "node:async_hooks";
import postgres, { type Sql } from "postgres";
import { config, assertDatabaseConfigured } from "@/src/lib/config";
import { ApiError } from "@/src/server/api/responses";

let sqlInstance: Sql | null = null;
let hasWarnedFallback = false;
const transactionStorage = new AsyncLocalStorage<Sql>();

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
  const transaction = transactionStorage.getStore();
  if (transaction) return transaction;
  const sql = getSql();
  if (!sql) {
    throw new ApiError(503, "DATABASE_UNAVAILABLE", `DATABASE_URL missing - ${operation} cannot persist.`);
  }

  return sql;
}

export async function withWriteTransaction<T>(_operation: string, callback: () => Promise<T>): Promise<T> {
  const existing = transactionStorage.getStore();
  if (existing) return callback();
  const sql = getSql();
  if (!sql) return callback();
  return sql.begin(async (transaction) =>
    transactionStorage.run(transaction as unknown as Sql, callback)
  ) as Promise<T>;
}

export async function closeSql(): Promise<void> {
  if (!sqlInstance) {
    return;
  }

  await sqlInstance.end({ timeout: 5 });
  sqlInstance = null;
}
