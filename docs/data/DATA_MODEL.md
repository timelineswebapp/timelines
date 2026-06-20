# Data Model

Authority Level: Data
Governed System: Current implemented data model.
Describes: Both

## Scope
Summarizes canonical database entities.

## Non-Scope
Does not replace SQL schema.

## Verified Implementation
PostgreSQL tables cover timelines, events, relationship tables, sources, tags, taxonomy governance, requests, slug history, analytics, recovery reports, and ad campaigns.

## Future Architecture
Registry tables/artifacts should become the rebuildable authority beyond publishing DB tables.

## Dependencies
`db/schema.sql`, `docs/references/DATABASE_SCHEMA.md`.

## Open Questions
- What data belongs in durable registries versus publishing projections?

## Future Evolution Guidance
Design future data so records are traceable to source artifacts.
