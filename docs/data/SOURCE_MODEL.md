# Source Model

Authority Level: Data
Governed System: Source records and event-source relationships.
Describes: Both

## Scope
Defines current citation data.

## Non-Scope
Does not define full bibliographic metadata.

## Verified Implementation
`sources` stores publisher, URL, and credibility score. `event_sources` links sources to events. Source URL is unique.

## Ownership Boundaries
This document is the primary authority for current source rows and event-source relationships.

- Current source model: this document.
- Root source relationship policy: `SOURCE_AUTHORITY.md`.
- Future source document registry: `docs/graph/SOURCE_REGISTRY.md`.
- Source credibility interpretation: `docs/governance/SOURCE_CREDIBILITY_POLICY.md`.
- Claim/citation provenance: `docs/governance/PROVENANCE_POLICY.md` and `docs/data/CLAIM_MODEL.md`.

Future source document requirements do not imply that current `sources` rows contain full bibliographic metadata.

## Future Architecture
Add source documents with title, author, publication date, source type, archive URL, access date, license, and field/claim-level citations.

## Dependencies
`SOURCE_AUTHORITY.md`, `src/server/repositories/source-repository.ts`, `db/schema.sql`.

## Open Questions
- What source types are allowed for publication?

## Future Evolution Guidance
Do not infer citation coverage from source rows alone.
