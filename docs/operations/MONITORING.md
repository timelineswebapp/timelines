# Monitoring

Authority Level: Operations
Governed System: Health and monitoring expectations.
Describes: Both

## Scope
Documents current monitoring hooks.

## Non-Scope
Does not configure external monitoring.

## Verified Implementation
`/api/health` validates required env and database connectivity. Structured logs exist for several error paths.

## Future Architecture
Monitor health, DB latency, import failures, recovery failures, search errors, empty relationship counts, and public page render failures.

## Dependencies
`app/api/health/route.ts`, `src/server/api/responses.ts`.

## Open Questions
- What external monitoring provider is authoritative?

## Future Evolution Guidance
Monitor data quality, not only uptime.
