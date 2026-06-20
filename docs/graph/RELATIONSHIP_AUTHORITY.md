# Relationship Authority

Authority Level: Graph
Governed System: Future typed graph relationships.
Describes: Both

## Scope
Defines graph relationship requirements.

## Non-Scope
Does not implement graph tables.

## Verified Implementation
Only timeline-event, event-source, and event-tag relationships are implemented.

## Ownership Boundaries
This document governs future graph relationship authority only.

- Current relationship tables are governed by `docs/data/RELATIONSHIP_MODEL.md`.
- Future predicate vocabulary is governed by `docs/graph/ONTOLOGY_AUTHORITY.md`.
- Future claim support is governed by `docs/data/CLAIM_MODEL.md` and `docs/governance/CLAIM_POLICY.md`.

This document must not override current relational behavior documented in the data model.

## Future Architecture
Relationships require subject, predicate, object, direction, evidence, confidence, lifecycle, and audit metadata.

## Dependencies
`docs/data/RELATIONSHIP_MODEL.md`.

## Open Questions
- Which predicates are canonical versus editorial?

## Future Evolution Guidance
Avoid untyped relationship tables.
