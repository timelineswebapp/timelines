# Provenance Policy

Authority Level: Governance
Governed System: Evidence and traceability.
Describes: Both

## Scope
Defines provenance expectations.

## Non-Scope
Does not define citation UI.

## Verified Implementation
Provenance is event-level through `event_sources`. There is no claim-level citation model.

## Future Architecture
Every factual claim should be traceable to source documents and ideally field-level or claim-level citations.

## Dependencies
`docs/data/SOURCE_MODEL.md`, `SOURCE_AUTHORITY.md`.

## Open Questions
- What content fields require citations?

## Future Evolution Guidance
Do not scale automated generation without claim-level provenance planning.
