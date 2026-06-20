# Milestone Registry

Authority Level: Graph
Governed System: Future canonical milestone registry.
Describes: Both

## Scope
Defines target milestone identity model.

## Non-Scope
Does not change current event table.

## Verified Implementation
Events are canonical public milestones with stable numeric IDs.

## Ownership Boundaries
This document governs future canonical milestone registry design.

- Current milestone records are governed by `docs/data/MILESTONE_MODEL.md`.
- Current milestone route architecture is governed by root `MILESTONE_ARCHITECTURE.md`.
- Future claim support is governed by `docs/data/CLAIM_MODEL.md`.
- Future merge/split policy is governed by `docs/governance/MERGE_SPLIT_POLICY.md`.

This document does not authorize changing public milestone IDs.

## Future Architecture
Milestones need canonical identity, aliases, same-as, merge/split, lifecycle, claim support, source provenance, and graph relationships.

## Dependencies
`events`, `eventRepository`, root `MILESTONE_ARCHITECTURE.md`.

## Open Questions
- Should registry IDs differ from publishing event IDs?

## Future Evolution Guidance
Preserve public event IDs while introducing registry identity carefully.
