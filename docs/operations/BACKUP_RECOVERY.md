# Backup Recovery

Authority Level: Operations
Governed System: Backup execution, restore execution, and recovery validation.
Describes: Implementation

## Scope
This runbook governs repository-owned backup and recovery workflows for TiMELiNES operational readiness. It preserves the institutional architecture:

Factory -> Governance -> Historical Library -> Published Memory -> Platform

The workflow is operational only. It does not change authority, certification, publication, Source Authority, or schema ownership boundaries.

## Backup Strategy
Authoritative backup command:

```bash
npm run ops:backup
```

The command requires `DATABASE_URL` and writes a timestamped backup under `ops/backups/` unless `BACKUP_DIR` is set.

Each backup contains:

- PostgreSQL custom-format dump from `pg_dump`.
- Current `db/schema.sql`.
- Repository-owned operational, source artifact, and authority documents from `data/`, `docs/operations/`, and `Knowledge/`.
- `manifest.json` with SHA-256 checksums for every artifact.

Secrets are never copied into the backup artifact. Environment variables remain externally managed.

## Backup Verification
Authoritative verification command:

```bash
npm run ops:backup:verify -- ops/backups/<stamp>/manifest.json
```

Verification fails if:

- A manifest path is absent from checksum coverage.
- Any checksum is malformed.
- Any artifact is missing, empty, or hash-mismatched.

## Restore Procedure
Restore is intentionally separated from production `DATABASE_URL`.

```bash
RESTORE_DATABASE_URL=postgres://... npm run ops:restore -- ops/backups/<stamp>/manifest.json
```

The restore command refuses to run without `RESTORE_DATABASE_URL`. It uses `pg_restore --clean --if-exists --no-owner --no-acl` against the restore target.

Production restore must be approved through incident command and rollback policy before execution. This repository provides the deterministic procedure; it does not self-authorize production data replacement.

## Recovery Validation
Authoritative validation command:

```bash
DATABASE_URL=postgres://restored-target npm run ops:recovery:verify
```

Validation queries cover:

- Public content: `timelines`, `events`.
- Relationship-backed context: `event_sources`, `event_tags`.
- Source Authority: `source_authority_records`, `source_authority_snapshots`.
- Historical Library and Published Memory: `historical_library_published_snapshots`, `published_memory_projections`.
- Provider runtime resilience: `provider_runtime_state`.

## Recovery Procedure
1. Verify the selected backup manifest.
2. Restore into an isolated database using `RESTORE_DATABASE_URL`.
3. Run recovery validation against the restored database.
4. Run application typecheck and test suite against the restored environment.
5. Compare critical counts to the backup-time operational report.
6. Promote the restored database only through the deployment and rollback policy owner.

## Validation Tests
Repository tests cover manifest validation and recovery query coverage. Runtime restore validation is intentionally integration-bound because it requires a real PostgreSQL target.
