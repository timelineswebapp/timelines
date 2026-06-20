# User Experience Principles

Authority Level: Product
Governed System: Reader and admin experience principles.
Describes: Both

## Scope
Defines experience-level decisions.

## Non-Scope
Does not define CSS implementation.

## Verified Implementation
The public experience emphasizes search, vertical timeline reading, milestone detail, source links, tags, related discovery, and mobile-friendly glass-style UI.

## Future Architecture
Future UX must make provenance, canonical identity, related entities, and uncertainty understandable without reducing readability.

## Dependencies
`components/timeline/*`, `components/forms/SearchBar.tsx`, `docs/design/*`.

## Open Questions
- Should credibility be shown as scores or labels?
- How should readers navigate graph relationships?

## Future Evolution Guidance
Keep chronology readable first; add graph/provenance progressively.
