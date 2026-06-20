# API Reference

Authority Level: Reference
Governed System: Implemented API surface summary.
Describes: Both

## Scope
Lists current route families.

## Non-Scope
Does not provide exhaustive payload examples.

## Verified Implementation
Public APIs include health, timelines, timeline detail, tags, search, homepage timeline pagination, timeline requests, and timeline-view telemetry. Admin APIs include analytics, timelines, events, tags, taxonomy, requests, ads, import preview/execute, relationship recovery, and report export.

## Future Architecture
Add versioned API docs and contract tests before external consumers depend on APIs.

## Dependencies
`app/api/*`, `src/server/validation/schemas.ts`.

## Open Questions
- Should public APIs be considered stable?

## Future Evolution Guidance
Document request/response contracts before adding clients outside this app.
