# Timelines

Authority Level: Design Component
Governed System: Timeline UI.
Describes: Both

## Scope
Documents timeline presentation.

## Non-Scope
Does not define chronology parsing.

## Verified Implementation
Timeline pages render a vertical event stream with event rows, detail sheet, ads, tags, related timelines, and sticky identity.

## Future Architecture
Add visual handling for uncertainty, date ranges, events in multiple timelines, and relationship graph entry points.

## Dependencies
`components/timeline/TimelineDetailView.tsx`, `components/timeline/EventRow.tsx`.

## Open Questions
- How should editorial ordering be signaled?

## Future Evolution Guidance
Chronology and readability remain primary.
