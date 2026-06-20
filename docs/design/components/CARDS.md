# Cards

Authority Level: Design Component
Governed System: Card components.
Describes: Both

## Scope
Documents card use.

## Non-Scope
Does not define every card class.

## Verified Implementation
Timeline summary cards, admin record cards, and glass cards are used for repeated items.

## Future Architecture
Define cards for timeline summaries, milestones, sources, tags, admin records, and factory batches.

## Dependencies
`components/timeline/TimelineSummaryCard.tsx`, `components/admin/*`.

## Open Questions
- Should milestone cards differ from timeline cards?

## Future Evolution Guidance
Cards should support scanning and avoid nested-card clutter.
