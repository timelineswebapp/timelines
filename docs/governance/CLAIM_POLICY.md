# Claim Policy

Authority Level: Governance
Governed System: Future factual claim governance.
Describes: Both

## Scope
This document defines how future factual claims should be governed.

## Non-Scope
This document does not assert that claim-level modeling exists today.

## Current Reality
- Event descriptions contain prose facts.
- Sources link at event level through `event_sources`.
- No claim table, claim status, claim confidence, or claim-level citation model exists.

## Future Architecture
Claims should become discrete factual assertions linked to milestones, source documents, citations, confidence, disputes, and revisions.

## Claim Governance Rules
- Claims must be source-supported before publication.
- Claims must preserve source provenance.
- Disputed claims must carry explicit status.
- Generated claims must remain draft until reviewed.

## Dependencies
- `docs/data/CLAIM_MODEL.md`
- `docs/governance/PROVENANCE_POLICY.md`
- `docs/governance/DISPUTE_POLICY.md`
- `docs/graph/RELATIONSHIP_AUTHORITY.md`

## Open Questions
- Which event fields become claim-backed first?
- How granular should claims be?

## Future Evolution
Add claim modeling before scaling automated research or knowledge graph reasoning.
