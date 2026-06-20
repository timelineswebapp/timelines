# Search Architecture

Authority Level: Architecture
Governed System: Public search behavior.
Describes: Both

## Scope
Defines current timeline and milestone search.

## Non-Scope
Does not define external search engines.

## Verified Implementation
Search uses PostgreSQL full-text vectors on timelines and events. Timeline search joins events and tags. Milestone search ranks exact title matches, event text, and tag matches.

## Future Architecture
Graph search should include entities, concepts, places, source titles, and relationship paths after registries exist.

## Dependencies
`src/server/repositories/timeline-repository.ts`, `src/server/repositories/event-repository.ts`, `app/api/search/route.ts`.

## Open Questions
- When should search move to a dedicated index?

## Future Evolution Guidance
Keep result limits bounded and indexed.
