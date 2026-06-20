# Secrets Management

Authority Level: Operations
Governed System: Secret classification, handling, and rotation guidance.
Describes: Both

## Scope
This document governs documentation-level handling of environment variables and secrets.

## Non-Scope
This document does not reveal, rotate, or configure secret values.

## Current Reality
- Server-side secrets include `DATABASE_URL`, `ADMIN_API_TOKEN`, and potentially future storage credentials.
- Public variables include `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, and `NEXT_PUBLIC_ADSENSE_ID`.
- `.env.example` exists as a non-secret template.
- Actual local secrets are not documented in the docs library.

## Future Architecture
Secrets should be classified by exposure level, owner, rotation cadence, storage location, blast radius, and revocation procedure.

## Secret Classes
- Public configuration: safe to expose in browser bundles.
- Server runtime secrets: never exposed to client code.
- Operational credentials: access to databases, artifact stores, deploy targets, and monitoring systems.

## Dependencies
- `docs/references/ENVIRONMENT_VARIABLES.md`
- `src/lib/config.ts`
- `src/lib/admin-route.ts`
- `.env.example`

## Open Questions
- Where are production secrets managed?
- What is the required admin token rotation cadence?

## Future Evolution
Add provider-specific rotation and incident procedures after production secret management is formalized.
