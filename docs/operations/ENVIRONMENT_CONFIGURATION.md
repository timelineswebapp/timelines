# Environment Configuration

Authority Level: Operations
Governed System: Environment variables and runtime configuration.
Describes: Both

## Scope
Documents env configuration.

## Non-Scope
Does not expose secret values.

## Verified Implementation
Known env vars include `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_ADSENSE_ID`, `ADMIN_API_TOKEN`, `ADMIN_ROUTE_SLUG`, and `R2_BUCKET`.

## Future Architecture
Add env validation docs for registry storage, job queues, backup targets, and role-based auth.

## Dependencies
`.env.example`, `src/lib/config.ts`, `src/lib/admin-route.ts`.

## Open Questions
- Is `R2_BUCKET` intended for future source artifacts?

## Future Evolution Guidance
Never document secret values.
