# Historical Experience Principles

Authority Level: Design
Governed System: Historical reading and discovery.
Describes: Both

## Scope
Defines design expectations for history content.

## Non-Scope
Does not define data model.

## Verified Implementation
Timeline pages foreground chronology, dates, event titles, descriptions, sources, tags, and related timelines.

## Future Architecture
Add uncertainty, provenance, entities, and relationships without reducing chronology readability.

## Dependencies
`components/timeline/TimelineDetailView.tsx`, `components/timeline/EventRow.tsx`.

## Open Questions
- How should approximate and disputed dates be visually differentiated?

## Future Evolution Guidance
Chronology is the primary navigation structure.
