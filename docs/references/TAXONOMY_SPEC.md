# Taxonomy Spec

Authority Level: Reference
Governed System: Current taxonomy model.
Describes: Both

## Scope
Documents tag/category taxonomy behavior.

## Non-Scope
Does not define future ontology.

## Verified Implementation
Tags are event-level labels. Categories are timeline-level strings with governance tables available for canonical category records, aliases, redirects, and merges. Tag governance tracks moderation status, usage count, aliases, redirects, merges, duplicates, and promotion candidates.

## Future Architecture
Taxonomy should map to canonical concept and entity registries.

## Dependencies
`TAXONOMY_ARCHITECTURE.md`, `db/schema.sql`, `src/server/repositories/taxonomy-repository.ts`.

## Open Questions
- Which taxonomy categories are canonical today?

## Future Evolution Guidance
Do not treat tags as ontology until governed concept records exist.
