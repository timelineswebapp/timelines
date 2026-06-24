# Rollback Policy

Authority Level: Operations
Governed System: Release, data, migration, and documentation rollback decisions.
Describes: Both

## Scope
This document governs when rollback is required and what kind of rollback applies.

## Non-Scope
This document does not provide executable rollback commands or alter migrations.

## Current Reality
- Application deploy rollback procedures are not implemented in repository docs.
- Import execution writes directly to publishing tables.
- Relationship recovery has preview/apply behavior and persisted reports.
- Existing data repair scripts include dry-run and write modes.

## Future Architecture
Rollback should be categorized as application rollback, schema rollback, data rollback, import batch rollback, or documentation rollback. Each category requires owner, trigger, verification, and incident record.

## Rollback Triggers
- Public pages fail to render.
- Milestone URLs break.
- Relationship counts collapse.
- Import creates bad data.
- Migration causes query failure or data loss risk.
- Secret exposure occurs.

## Dependencies
- `docs/operations/MIGRATION_RUNBOOK.md`
- `docs/factory/IMPORT_BATCH_MODEL.md`
- `docs/incidents/*`
- `scripts/check-and-fix-data.ts`
- `scripts/backfill-event-relationships.ts`

## Open Questions
- What deployment system provides application rollback?
- What database backup point-in-time recovery is available?

## Future Evolution
Add exact rollback procedures once deployment, migration, and backup tooling are authoritative.
