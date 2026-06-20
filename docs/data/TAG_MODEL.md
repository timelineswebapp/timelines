# Tag Model

Authority Level: Data
Governed System: Tags and taxonomy relationships.
Describes: Both

## Scope
Defines implemented tag behavior.

## Non-Scope
Does not define future concept ontology.

## Verified Implementation
`tags` stores slug and name. `event_tags` links tags to events. Tag governance, aliases, redirects, and merges exist. Timelines inherit tags through events.

## Future Architecture
Tags should evolve into or map to canonical concepts, entities, and themes.

## Dependencies
`TAXONOMY_ARCHITECTURE.md`, `src/server/repositories/tag-repository.ts`, `src/server/repositories/taxonomy-repository.ts`.

## Open Questions
- Which tags should become canonical concepts?

## Future Evolution Guidance
Normalize composite tags only after relationship coverage is recovered.
