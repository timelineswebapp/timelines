# Database Schema Reference

Authority Level: Reference
Governed System: Human-readable schema summary.
Describes: Both

## Scope
Summarizes `db/schema.sql`.

## Non-Scope
Does not replace SQL as source of truth.

## Verified Implementation
Schema includes timelines, events, relationship tables, sources, tags, taxonomy governance, timeline requests, slug history, analytics events, relationship recovery reports, and ad campaigns with indexes and update triggers.

## Future Architecture
Future registry schemas should be documented separately before implementation.

## Dependencies
`db/schema.sql`, `db/migrations/*`.

## Open Questions
- Should generated schema docs be produced from SQL?

## Future Evolution Guidance
Update after every migration.
