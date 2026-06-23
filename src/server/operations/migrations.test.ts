import test from "node:test";
import assert from "node:assert/strict";
import { migrationLedgerSql, validateMigrationPlan } from "@/src/server/operations/migrations";

test("migration validation rejects duplicate ids and missing rollback files", () => {
  const result = validateMigrationPlan(
    [
      { id: "20260630_provider_runtime_state", path: "db/migrations/20260630_provider_runtime_state.sql", sql: "SELECT 1;" },
      { id: "20260630_provider_runtime_state", path: "db/migrations/20260630_provider_runtime_state_copy.sql", sql: "SELECT 2;" }
    ],
    new Set()
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.duplicateIds, ["20260630_provider_runtime_state"]);
  assert.deepEqual(result.missingRollbackFiles, ["20260630_provider_runtime_state", "20260630_provider_runtime_state"]);
});

test("migration ledger SQL creates authoritative applied migration record", () => {
  const sql = migrationLedgerSql();
  assert.match(sql, /operational_migration_ledger/);
  assert.match(sql, /migration_id TEXT PRIMARY KEY/);
  assert.match(sql, /checksum TEXT NOT NULL/);
});
