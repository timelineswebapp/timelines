# Timeline Patterns

Authority Level: Design Pattern
Governed System: Timeline interaction patterns.
Describes: Both

## Scope
Documents timeline reading interactions.

## Non-Scope
Does not define CSS implementation.

## Verified Implementation
Timeline pages support scroll restoration, event selection, detail sheet, share actions, sticky identity, and back-to-top.

## Future Architecture
Add compare timelines and graph context after canonical relationships exist.

## Dependencies
`components/timeline/TimelineDetailView.tsx`.

## Open Questions
- Should event detail open as route or sheet?

## Future Evolution Guidance
Interaction should not break canonical URLs.
