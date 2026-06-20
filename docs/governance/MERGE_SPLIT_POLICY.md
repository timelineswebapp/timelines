# Merge Split Policy

Authority Level: Governance
Governed System: Future canonical record merge and split behavior.
Describes: Both

## Scope
Defines policy skeleton.

## Non-Scope
Does not implement merge/split.

## Verified Implementation
Tag/category merge history tables exist. Timeline slug history exists. Event/milestone merge or split records do not exist.

## Future Architecture
Add merge/split records for milestones, entities, concepts, and sources with redirects and provenance preservation.

## Dependencies
`db/schema.sql`, taxonomy migration files.

## Open Questions
- How should merged milestones redirect?

## Future Evolution Guidance
Never delete canonical records when redirect/deprecation preserves identity.
