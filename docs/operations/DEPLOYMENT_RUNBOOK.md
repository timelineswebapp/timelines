# Deployment Runbook

Authority Level: Operations
Governed System: Deployment expectations.
Describes: Both

## Scope
Documents current deployment assumptions.

## Non-Scope
Does not define hosting account setup.

## Verified Implementation
Vercel hosts the Next.js application. Google Cloud project `tiimeliines` hosts the serverless API, generation pipeline, queues, scheduler, Firestore database, Vertex AI integration, and institutional archive. `npm run build`, `npm run typecheck`, `npm run lint`, and both serverless certification commands are available.

## Serverless Infrastructure Deployment

The authoritative, idempotent deployment command is:

```bash
./infra/gcp/deploy-serverless.sh
```

The script refuses to execute unless the active project is `tiimeliines` and the active account is `timelineswebapp@gmail.com`. It configures dedicated service identities, least-privilege roles, bounded queues, private function invokers, deny-by-default Firestore rules, indexes, PITR, delete protection, the private archive bucket, and the daily discovery schedule.

Never deploy by weakening private-function IAM or allowing client access to Firestore.

## Data migration and certification

Run in this order:

```bash
npm run serverless:migrate:dry-run
npm run serverless:migrate:apply
npm run serverless:migrate:verify
SERVERLESS_API_BASE_URL=https://us-central1-tiimeliines.cloudfunctions.net/timelines-public-api npm run serverless:api:verify
```

The apply command is resumable and idempotent. Do not start apply until the dry-run inventory and hashes have been reviewed. Do not promote the application until verification reports zero table mismatches and live API parity passes.

## Vercel application promotion

Required server-side environment variables:

- `SERVERLESS_API_BASE_URL=https://us-central1-tiimeliines.cloudfunctions.net/timelines-public-api`
- `BACKEND_SHARED_SECRET`, copied securely from Google Secret Manager without printing it

Keep `DATABASE_URL` during the rollback observation window. Deploy a preview first, smoke test health, homepage, timeline, milestone, historical-object, relationship, search, sitemap, and topic-intake validation, then promote that exact build to production.

## GitHub Actions Scheduler
The GitHub Actions scheduler below belongs to the retained PostgreSQL rollback runtime. It must remain disabled for the active generation path after serverless cutover; Cloud Scheduler and Cloud Tasks own the new runtime.

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
- `npm run serverless:functions:test`
- `npm run serverless:functions:build`
- `npm run serverless:migrate:verify`
- `npm run serverless:api:verify`

Schema-affecting deployments require rollback SQL and a verified backup manifest before production promotion.

## Rollback Procedure
Rollback requires:

- Incident commander approval.
- Identified deployment artifact or previous production release.
- Verified backup manifest when data state is affected.
- Migration rollback procedure when schema changes are included.
- Post-rollback execution of typecheck, tests, monitoring verification, and recovery checks where applicable.

For `TL-SERVERLESS-MIGRATION-001`, promote the Vercel deployment corresponding to annotated tag `pre-serverless-migration-001`. Do not delete Firestore, Cloud Tasks, Cloud Functions, audit data, or archive objects during rollback. Preserve them for reconciliation and incident analysis. PostgreSQL remains the application rollback source until the observation window is explicitly closed.

## Dependencies
`README.md`, `package.json`, `next.config.mjs`.

## Future Evolution Guidance
Do not deploy schema-affecting changes without migration and rollback notes.
