# Relationship Model

Authority Level: Data
Governed System: Implemented and future relationships.
Describes: Both

## Scope
Defines current relationship tables and missing graph relationships.

## Non-Scope
Does not define full graph ontology.

## Verified Implementation
Current relationships are `timeline_events`, `event_sources`, and `event_tags`.

## Ownership Boundaries
This document is the primary authority for current relational relationship tables.

- Current database relationships: this document.
- Future typed graph predicates: `docs/graph/RELATIONSHIP_AUTHORITY.md`.
- Future ontology vocabulary: `docs/graph/ONTOLOGY_AUTHORITY.md`.
- Event-source evidence policy: `docs/governance/PROVENANCE_POLICY.md`.

Graph documents must not be read as implemented database behavior until matching schema and repository support exists.

## Future Architecture
Add typed relationships for event causality, event sequence, entity participation, source support, disputes, same-as, merge, split, and concept membership.

## Dependencies
`db/schema.sql`, `docs/graph/RELATIONSHIP_AUTHORITY.md`.

## Open Questions
- Which graph relationships affect public ranking?

## Future Evolution Guidance
Every relationship must have type, direction, provenance, and lifecycle state.
