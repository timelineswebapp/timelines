# Timeline Model

Authority Level: Data
Governed System: Timeline records and timeline membership.
Describes: Both

## Scope
Defines timeline data ownership.

## Non-Scope
Does not define event chronology internals.

## Verified Implementation
`timelines` stores title, slug, description, category, ordering mode, search vector, timestamps. `timeline_events` links events with per-timeline order. `timeline_slug_history` preserves old slugs for redirects.

## Future Architecture
Timelines need publication state, editorial owner, revision history, and quality score.

## Dependencies
`src/server/repositories/timeline-repository.ts`, `db/schema.sql`.

## Open Questions
- Should timelines be composed from canonical milestone registries only?

## Future Evolution Guidance
Do not duplicate event facts into timelines.
