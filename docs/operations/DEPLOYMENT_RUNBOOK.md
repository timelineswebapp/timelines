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

## Future Architecture
Deployments should run CI checks, data quality gates, migration checks, and rollback planning.

## Dependencies
`README.md`, `package.json`, `next.config.mjs`.

## Open Questions
- Are migrations applied manually or by deployment pipeline?

## Future Evolution Guidance
Do not deploy schema-affecting changes without migration and rollback notes.
