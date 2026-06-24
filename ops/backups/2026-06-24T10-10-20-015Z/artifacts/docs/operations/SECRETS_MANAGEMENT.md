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

## Rotation Policy
Secrets are classified by exposure level, owner, rotation cadence, storage location, blast radius, and revocation procedure.

## Secret Classes
- Public configuration: safe to expose in browser bundles.
- Server runtime secrets: never exposed to client code.
- Operational credentials: access to databases, artifact stores, deploy targets, and monitoring systems.

## Dependencies
- `docs/references/ENVIRONMENT_VARIABLES.md`
- `src/lib/config.ts`
- `src/lib/admin-route.ts`
- `.env.example`

## Production Secret Management
Production secrets are managed by deployment environment secret storage. Secret values must not be committed, logged, or copied into backup artifacts.

## Required Rotation Cadence
- Admin operator tokens: rotate at least every 90 days and immediately on operator departure or suspected exposure.
- `ADMIN_API_TOKEN`: migration-only fallback; rotate at least every 30 days while enabled.
- Database credentials: rotate at least every 180 days and immediately after suspected exposure.
- Webhook URLs: rotate at least every 180 days or after delivery target ownership changes.
 
Rotation must preserve service continuity by adding replacement credentials before revoking old credentials where the platform supports parallel credentials.

## Future Evolution
Add provider-specific rotation and incident procedures after production secret management is formalized.
