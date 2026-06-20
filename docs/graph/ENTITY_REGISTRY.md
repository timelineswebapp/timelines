# Entity Registry

Authority Level: Graph
Governed System: Future canonical entities.
Describes: Both

## Scope
Defines target entity registry.

## Non-Scope
Does not exist in current schema.

## Verified Implementation
People, places, organizations, works, and technologies are not first-class entities. Locations are event text fields.

## Future Architecture
Create canonical entities with type, aliases, external IDs, lifecycle, provenance, and relationships to milestones.

## Dependencies
`events.location`, `docs/references/TAXONOMY_SPEC.md`.

## Open Questions
- Which entity types launch first?

## Future Evolution Guidance
Start with places and actors because events already imply them.
