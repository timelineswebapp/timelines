import test from "node:test";
import assert from "node:assert/strict";
import { requiredRecoveryValidationQueries, validateBackupManifest, type BackupManifest } from "@/src/server/operations/backup-recovery";

test("backup manifest validation requires checksum coverage for every artifact", () => {
  const manifest: BackupManifest = {
    generatedAt: "2026-06-23T00:00:00.000Z",
    databaseDumpPath: "ops/backups/example/database.dump",
    schemaPath: "ops/backups/example/schema.sql",
    artifactPaths: ["ops/backups/example/artifacts/data/sample.csv"],
    sha256: {
      "ops/backups/example/database.dump": "a".repeat(64),
      "ops/backups/example/schema.sql": "b".repeat(64)
    }
  };

  const result = validateBackupManifest(manifest);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingPaths, ["ops/backups/example/artifacts/data/sample.csv"]);
});

test("recovery validation covers authority, publication, projection, and provider runtime state", () => {
  const queries = requiredRecoveryValidationQueries().join("\n");
  assert.match(queries, /source_authority_records/);
  assert.match(queries, /historical_library_published_snapshots/);
  assert.match(queries, /published_memory_projections/);
  assert.match(queries, /provider_runtime_state/);
});
