# Claim Model

Authority Level: Data
Governed System: Future claim/assertion data model.
Describes: Future Architecture

## Scope
This document defines the future data expectations for factual claims.

## Non-Scope
This document does not describe an implemented table or change the schema.

## Current Reality
No claim/assertion model exists. Milestone facts are stored as event fields and prose descriptions. Event-level sources provide broad support but not claim-level citation.

## Future Architecture
A claim model should represent an atomic factual assertion with subject, predicate or field context, object/value, source support, confidence, lifecycle state, dispute state, and revision history.

## Candidate Fields
- Claim ID.
- Milestone or entity subject.
- Predicate or field path.
- Value.
- Confidence.
- Lifecycle status.
- Source/citation references.
- Reviewer and revision metadata.

## Dependencies
- `docs/governance/CLAIM_POLICY.md`
- `docs/governance/PROVENANCE_POLICY.md`
- `docs/data/MILESTONE_MODEL.md`
- `docs/graph/RELATIONSHIP_AUTHORITY.md`

## Open Questions
- Should claims be modeled as relational rows, graph edges, or both?
- Should descriptions be decomposed into claims?

## Future Evolution
Do not implement claim extraction until source document and citation authority are defined.
