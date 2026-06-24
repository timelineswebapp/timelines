# Operations Constitution

Authority Level: Operations
Governed System: Production operations authority, operational safety, and runbook precedence.
Describes: Both

## Scope
This document owns the operating principles for deploys, migrations, secrets, rollbacks, monitoring, backups, admin operations, and incident response.

## Non-Scope
This document does not change application behavior, deployment configuration, database schema, or incident history.

## Current Reality
- Deployment, backup, environment, admin operations, incident response, and monitoring documentation exists under `docs/operations/`.
- The implemented health endpoint is `/api/health`.
- Production requires `DATABASE_URL`.
- Admin operations are protected by `ADMIN_API_TOKEN` and a configured admin route slug.
- No repository-owned backup automation, migration automation, or rollback automation is documented as implemented.

## Future Architecture
Operations should become a governed system with explicit CI gates, migration runbooks, backup/restore drills, secret rotation, rollback criteria, alert thresholds, and incident severity levels.

## Ownership Boundaries
- This document owns operations precedence.
- `DEPLOYMENT_RUNBOOK.md` owns deploy execution guidance.
- `MIGRATION_RUNBOOK.md` owns migration safety guidance.
- `SECRETS_MANAGEMENT.md` owns secret handling guidance.
- `ROLLBACK_POLICY.md` owns rollback decision criteria.
- `MONITORING.md` owns health and alerting expectations.
- `INCIDENT_RESPONSE.md` owns incident response format and lifecycle.

## Dependencies
- `docs/authority/05_EXECUTION_CANON.md`
- `docs/operations/DEPLOYMENT_RUNBOOK.md`
- `docs/operations/MIGRATION_RUNBOOK.md`
- `docs/operations/SECRETS_MANAGEMENT.md`
- `docs/operations/ROLLBACK_POLICY.md`
- `docs/operations/MONITORING.md`
- `docs/operations/INCIDENT_RESPONSE.md`

## Open Questions
- Which external CI/CD system is authoritative?
- Who owns production approval for migrations?
- What alerting provider is authoritative?

## Future Evolution
Convert this document from principles to enforceable runbook policy when CI, backups, monitoring, and role-based admin operations are implemented.
