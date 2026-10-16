import test from "node:test";
import assert from "node:assert/strict";
import { migrationLedgerSql, validateMigrationPlan } from "@/src/server/operations/migrations";
import { readFileSync } from "node:fs";

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

test("institutional appointment migration has immutable records and a scoped rollback", () => {
  const migration = readFileSync("db/migrations/20260730_institutional_actor_appointments.sql", "utf8");
  const rollback = readFileSync("db/rollbacks/20260730_institutional_actor_appointments.sql", "utf8");
  assert.match(migration, /institutional_actor_appointments/);
  assert.match(migration, /authorization_version/);
  assert.match(migration, /prevent_institutional_actor_appointment_mutation/);
  assert.match(rollback, /DROP TABLE IF EXISTS institutional_actor_appointments/);
  assert.doesNotMatch(rollback, /DELETE FROM/);
});
