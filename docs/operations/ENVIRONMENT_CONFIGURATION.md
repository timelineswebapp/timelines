# Environment Configuration

Authority Level: Operations
Governed System: Environment variables and runtime configuration.
Describes: Both

## Scope
Documents env configuration.

## Non-Scope
Does not expose secret values.

## Verified Implementation
Public Vercel runtime variables:

- `SERVERLESS_API_BASE_URL`: required in every deployed environment; set to the HTTPS `timelines-public-api` function origin.
- `BACKEND_SHARED_SECRET`: at least 32 characters; signs Vercel-to-backend topic-intake requests and must equal the Secret Manager value.
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, and `NEXT_PUBLIC_ADSENSE_ID`: public application configuration.

Google Cloud function variables:

- `GOOGLE_CLOUD_PROJECT=tiimeliines`
- `FUNCTION_REGION=us-central1`
- `VERTEX_LOCATION=global`
- `VERTEX_MODEL=gemini-2.5-flash`
- `TASK_INVOKER_EMAIL=timelines-tasks-invoker@tiimeliines.iam.gserviceaccount.com`

Google Secret Manager owns `IP_HASH_SALT` and `BACKEND_SHARED_SECRET`. Secret values must not appear in source, logs, deployment output, or migration reports.

Legacy rollback variables include `DATABASE_URL`, `ADMIN_API_TOKEN`, `ADMIN_ROUTE_SLUG`, and `R2_BUCKET`. Preserve `DATABASE_URL` throughout the serverless observation window; the active public read path does not use it.

## Deployment invariant

`src/server/serverless/backend-client.ts` fails closed when `SERVERLESS_API_BASE_URL` is absent in a Vercel environment. Topic intake fails closed when `BACKEND_SHARED_SECRET` is absent or shorter than 32 characters.

## Dependencies
`.env.example`, `src/lib/config.ts`, `src/lib/admin-route.ts`.

## Open Questions
- Close the PostgreSQL rollback window only after an explicitly approved production observation period.

## Future Evolution Guidance
Never document secret values.
