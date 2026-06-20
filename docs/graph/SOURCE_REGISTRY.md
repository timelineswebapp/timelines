# Source Registry

Authority Level: Graph
Governed System: Future source document registry.
Describes: Both

## Scope
Defines source registry target.

## Non-Scope
Does not replace current `sources` immediately.

## Verified Implementation
Current source records are publisher, URL, credibility score.

## Ownership Boundaries
This document governs future source document registry design.

- Current `sources` and `event_sources`: `docs/data/SOURCE_MODEL.md`.
- Credibility policy: `docs/governance/SOURCE_CREDIBILITY_POLICY.md`.
- Provenance policy: `docs/governance/PROVENANCE_POLICY.md`.
- External source identifiers: `docs/graph/EXTERNAL_IDENTIFIER_REGISTRY.md`.

This document does not redefine current source table semantics.

## Future Architecture
Source registry should model documents, editions, archived versions, authors, dates, source type, reliability, and citation spans.

## Dependencies
`sources`, `event_sources`, `SOURCE_AUTHORITY.md`.

## Open Questions
- How are dead links archived?

## Future Evolution Guidance
Keep URL uniqueness but do not treat URL as complete bibliographic identity.
