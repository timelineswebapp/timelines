export type MigrationFile = {
  id: string;
  path: string;
  sql: string;
};

export type MigrationValidationResult = {
  ok: boolean;
  duplicateIds: string[];
  unorderedIds: string[];
  missingRollbackFiles: string[];
};

export function validateMigrationPlan(migrations: MigrationFile[], rollbackIds: Set<string>): MigrationValidationResult {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const unorderedIds: string[] = [];
  const missingRollbackFiles: string[] = [];
  let previous = "";

  for (const migration of migrations) {
    if (seen.has(migration.id)) duplicateIds.push(migration.id);
    seen.add(migration.id);
    if (previous && migration.id < previous) unorderedIds.push(migration.id);
    previous = migration.id;
    if (!rollbackIds.has(migration.id)) missingRollbackFiles.push(migration.id);
  }

  return {
    ok: duplicateIds.length === 0 && unorderedIds.length === 0 && missingRollbackFiles.length === 0,
    duplicateIds,
    unorderedIds,
    missingRollbackFiles
  };
}

export function migrationLedgerSql(): string {
  return `
CREATE TABLE IF NOT EXISTS operational_migration_ledger (
  migration_id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by TEXT NOT NULL,
  execution_ms INTEGER NOT NULL CHECK (execution_ms >= 0)
);`.trim();
}
