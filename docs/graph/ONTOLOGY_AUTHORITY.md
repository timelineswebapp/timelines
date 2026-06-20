# Ontology Authority

Authority Level: Graph
Governed System: Future graph ontology, entity types, concept types, and predicates.
Describes: Future Architecture

## Scope
This document defines the future authority for graph vocabulary.

## Non-Scope
This document does not claim a graph ontology exists today and does not implement graph tables.

## Current Reality
The implemented system has tags, categories, event-source links, event-tag links, and timeline-event links. It does not have first-class entity types, ontology terms, or predicate registries.

## Future Architecture
The ontology should define allowed node types, relationship predicates, directionality, cardinality, lifecycle states, provenance requirements, and public rendering rules.

## Future Ontology Areas
- Milestone/event.
- Person.
- Place.
- Organization.
- Work.
- Concept.
- Period.
- Source document.
- Claim.

## Dependencies
- `docs/graph/ENTITY_REGISTRY.md`
- `docs/graph/CONCEPT_REGISTRY.md`
- `docs/graph/RELATIONSHIP_AUTHORITY.md`
- `docs/data/CLAIM_MODEL.md`

## Open Questions
- Which ontology standard, if any, should be aligned with?
- Which predicates are allowed in the first graph release?

## Future Evolution
Create ontology terms before importing graph relationships at scale.
