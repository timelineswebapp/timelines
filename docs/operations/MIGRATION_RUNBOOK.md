# Migration Runbook

Authority Level: Operations
Governed System: Database migration authority and rollback workflow.
Describes: Implementation

## Scope
This runbook governs database migration execution. It does not redesign schema ownership, repositories, deployment, Source Authority, Governance, Historical Library, Published Memory, or Platform behavior.

## Authoritative Runner
Authoritative command:

```bash
npm run ops:migrations
```

Dry-run command:

```bash
npm run ops:migrations:dry-run
```

The runner:

- Reads `db/migrations/*.sql` in lexical order.
- Creates `operational_migration_ledger` before applying migrations.
- Applies each unapplied migration in a transaction.
- Records migration id, checksum, operator, and execution time.
- Requires rollback files for new operational migrations beginning with `20260630`.

Historical migrations before this operational hardening program remain accepted implementation reality. They are not rewritten.

## Migration Execution Workflow
1. Add forward SQL under `db/migrations/<id>.sql`.
2. Add rollback SQL under `db/rollbacks/<id>.sql`.
3. Update `db/schema.sql`.
4. Run `npm run ops:migrations:dry-run`.
5. Run `npm run typecheck`.
6. Run `npm test`.
7. Apply with `npm run ops:migrations` in the approved environment.
8. Run migration-specific verification queries.

## Migration Verification
Every migration must have:

- Deterministic id.
- Forward SQL.
- Rollback SQL or explicitly documented compensating action.
- Validation query.
- Schema file update.
- Test coverage when behavior changes.

The provider runtime state migration is additive and validated by provider persistence tests plus schema/typecheck.

## Rollback Procedure
Authoritative rollback command:

```bash
npm run ops:migration:rollback -- <migration_id>
```

Rollback:

- Requires a concrete migration id matching `<yyyymmdd>_<name>`.
- Executes `db/rollbacks/<migration_id>.sql` in a transaction.
- Deletes the migration ledger row only after rollback SQL succeeds.

Rollback is an operational control. It does not bypass incident command, deployment approval, or publication certification boundaries.

## Migration Validation Process
Use `src/server/operations/migrations.ts` for validation logic. Tests assert duplicate detection, ordering detection, rollback coverage, and ledger SQL presence.
