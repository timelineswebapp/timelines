# Execution Canon

Authority Level: Canonical
Governed System: Build, test, import, recovery, release, and operational execution.
Describes: Both

## Scope
This document defines the current execution model and minimum operational expectations.

## Non-Scope
This document does not replace detailed deployment, backup, or incident runbooks.

## Verified Implementation
Available commands:
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`
- `npm run lint`
- `npm run typecheck`
- `npm run seed`
- `npm run data:audit`
- `npm run data:repair`
- `npm run relationships:backfill`
- `npm run relationships:backfill:apply`

Operational facts:
- Health endpoint is `/api/health`.
- Production requires `DATABASE_URL`.
- Import execution revalidates homepage, search, and affected timelines.
- Relationship recovery defaults are preview-oriented through service and script naming.
- Structured JSON logs are used for critical errors and warnings in several server paths.

## Future Architecture
Execution should become batch-audited and reproducible:
- Every factory/import run has an ID.
- Every batch has input hashes, output reports, approval status, and rollback metadata.
- Every release runs lint, typecheck, tests, build, and data-quality checks.

## Dependencies
- `package.json`
- `app/api/health/route.ts`
- `scripts/*`
- `docs/operations/*`
- `docs/factory/*`

## Open Questions
- What CI system is authoritative?
- What is the minimum quality report before release?
- What backup target stores authoritative registry artifacts?

## Future Evolution Guidance
Do not add production write workflows without dry-run semantics, persisted reports, and explicit approval.
