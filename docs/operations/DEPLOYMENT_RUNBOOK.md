# Deployment Runbook

Authority Level: Operations
Governed System: Deployment expectations.
Describes: Both

## Scope
Documents current deployment assumptions.

## Non-Scope
Does not define hosting account setup.

## Verified Implementation
README identifies Vercel/Neon readiness. `npm run build`, `npm run typecheck`, and `npm run lint` are available. Production requires `DATABASE_URL`.

## Authoritative Deployment Workflow
Machine-readable deployment workflow:

```text
ops/deployment/workflow.json
```

Promotion is staging to production only.

Required validation before production promotion:

- `npm run typecheck`
- `npm test`
- `npm run lint`
- `npm run build`
- `npm audit --audit-level=high --omit=dev`
- `npm run ops:migrations:dry-run`
- `npm run ops:monitoring:verify`
- `npm run ops:production:verify`

Schema-affecting deployments require rollback SQL and a verified backup manifest before production promotion.

## Rollback Procedure
Rollback requires:

- Incident commander approval.
- Identified deployment artifact or previous production release.
- Verified backup manifest when data state is affected.
- Migration rollback procedure when schema changes are included.
- Post-rollback execution of typecheck, tests, monitoring verification, and recovery checks where applicable.

## Dependencies
`README.md`, `package.json`, `next.config.mjs`.

## Future Evolution Guidance
Do not deploy schema-affecting changes without migration and rollback notes.
