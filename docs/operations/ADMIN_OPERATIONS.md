# Admin Operations

Authority Level: Operations
Governed System: Admin usage and safety.
Describes: Both

## Scope
Documents implemented admin capabilities.

## Non-Scope
Does not grant permissions.

## Verified Implementation
Admin dashboard is available only at configured `ADMIN_ROUTE_SLUG`. API calls require `ADMIN_API_TOKEN`. Admin can manage timelines, events, tags, requests, ads, imports, analytics, taxonomy snapshots, and relationship recovery.

## Future Architecture
Add roles, audit logs, operation confirmations, and review queues.

## Dependencies
`app/[adminRoute]/page.tsx`, `components/admin/*`, `app/api/admin/*`.

## Open Questions
- How should admin token rotation work?

## Future Evolution Guidance
Admin workflows should be auditable and reversible where possible.
