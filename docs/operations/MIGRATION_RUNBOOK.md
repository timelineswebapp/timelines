# Migration Runbook

Authority Level: Operations
Governed System: Database migration safety and schema-change operations.
Describes: Both

## Scope
This document governs how schema changes should be prepared, reviewed, applied, verified, and rolled back.

## Non-Scope
This document does not modify existing migrations or define new schema.

## Current Reality
- Schema is defined in `db/schema.sql`.
- Existing migrations are stored in `db/migrations/`.
- No repository script is documented as the authoritative production migration runner.
- Several repositories include schema capability checks for backward-compatible reads.

## Future Architecture
Every migration should include purpose, affected tables, lock/latency risk, rollback strategy, data backfill plan, validation query, and documentation updates.

## Required Migration Record
Future migration documentation should include:
- Migration identifier.
- Production risk classification.
- Forward SQL.
- Rollback SQL or compensating action.
- Verification queries.
- Affected docs.

## Dependencies
- `db/schema.sql`
- `db/migrations/*`
- `docs/references/DATABASE_SCHEMA.md`
- `docs/operations/ROLLBACK_POLICY.md`

## Open Questions
- Are migrations applied manually, by Vercel integration, or by a separate operator?
- Should migration execution require an ADR?

## Future Evolution
Add a migration checklist and production execution template once the authoritative deployment path is formalized.
