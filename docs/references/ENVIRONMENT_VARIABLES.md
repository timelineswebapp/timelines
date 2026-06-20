# Environment Variables Reference

Authority Level: Reference
Governed System: Runtime configuration reference.
Describes: Both

## Scope
Documents variable names and intent.

## Non-Scope
Does not include secret values.

## Verified Implementation
- `DATABASE_URL`: PostgreSQL connection; required in production.
- `NEXT_PUBLIC_SITE_URL`: public site base URL.
- `NEXT_PUBLIC_GA_ID`: Google Analytics ID.
- `NEXT_PUBLIC_ADSENSE_ID`: AdSense ID.
- `ADMIN_API_TOKEN`: admin API token.
- `ADMIN_ROUTE_SLUG`: hidden admin route slug.
- `R2_BUCKET`: configured but not materially used in inspected implementation.

## Future Architecture
Add registry storage, artifact bucket, job queue, and auth provider variables when implemented.

## Dependencies
`src/lib/config.ts`, `src/lib/admin-route.ts`, `.env.example`.

## Open Questions
- Is `R2_BUCKET` reserved for future artifacts?

## Future Evolution Guidance
Keep public and server-only variables clearly separated.
