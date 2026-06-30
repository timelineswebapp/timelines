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

## GitHub Actions Scheduler
Factory Runtime V2 scheduling is owned by `.github/workflows/factory-scheduler.yml`.
GitHub Actions invokes the existing HTTPS cron routes every 15 minutes in the
certified institutional order:

```text
/api/cron/factory
  -> /api/cron/governance
    -> /api/cron/maintenance
```

The workflow also supports manual execution through `workflow_dispatch`.
Vercel hosts the application and has no configured Vercel Cron schedules, which
keeps deployment compatible with the Vercel Hobby plan.

Configure these GitHub Actions repository secrets:

- `TIMELINES_BASE_URL`: canonical HTTPS deployment origin, without a required
  trailing slash (for example, the production Vercel custom domain).
- `CRON_SECRET`: server-side bearer secret matching the production Vercel
  `CRON_SECRET` environment variable.

Both secrets are mandatory. Secret values must never be committed or logged.
The scheduler stops dependent execution after a transport failure or non-200
response, while preserving the response body and elapsed time in the workflow
logs.

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
