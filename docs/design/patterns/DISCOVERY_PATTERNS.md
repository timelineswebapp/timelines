# Discovery Patterns

Authority Level: Design Pattern
Governed System: Discovery UI.
Describes: Both

## Scope
Documents current discovery surfaces.

## Non-Scope
Does not define recommendations algorithm.

## Verified Implementation
Discovery occurs through homepage feed, search, related timelines, categories, tags, and same-category fallbacks.

## Future Architecture
Add graph-driven discovery only after relationship authority is reliable.

## Dependencies
`src/server/services/content-service.ts`, `components/timeline/HomeTimelineFeed.tsx`.

## Open Questions
- What discovery metrics indicate quality?

## Future Evolution Guidance
Prefer explainable discovery over opaque recommendations.
