# System Overview

Authority Level: Architecture
Governed System: High-level system composition.
Describes: Both

## Scope
Summarizes implemented software boundaries.

## Non-Scope
Does not document every route or SQL query.

## Verified Implementation
TiMELiNES is a Next.js 14 TypeScript app. Public pages use server-side services. Admin APIs validate input and call services. Repositories access PostgreSQL through `postgres`.

## Future Architecture
Separate future registry/factory workloads from public rendering where long-running jobs or approvals are needed.

## Dependencies
`app/`, `components/`, `src/server/`, `db/schema.sql`.

## Open Questions
- Should factory workflows run outside Vercel request lifecycle?

## Future Evolution Guidance
Keep request paths bounded and move long-running work to durable jobs.
