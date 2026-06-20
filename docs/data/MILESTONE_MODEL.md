# Milestone Model

Authority Level: Data
Governed System: Events as public milestones.
Describes: Both

## Scope
Defines event/milestone identity.

## Non-Scope
Does not define future claim model.

## Verified Implementation
Events are public milestones. Milestone URLs use `/milestone/{eventId}/{slug}`. Event detail includes chronology, title, description, importance, location, image, sources, tags, and timeline links.

## Ownership Boundaries
This document is the primary authority for current event-as-milestone data behavior.

- Current milestone data model: this document.
- Current milestone public route behavior: root `MILESTONE_ARCHITECTURE.md` and `app/milestone/[id]/[slug]/page.tsx`.
- Future canonical milestone registry: `docs/graph/MILESTONE_REGISTRY.md`.
- Future publication state: `docs/data/PUBLICATION_STATE_MODEL.md`.
- Future revision behavior: `docs/data/REVISION_MODEL.md`.

Future registry identity must preserve current public event ID stability unless an explicit migration authority supersedes it.

## Future Architecture
Milestones need lifecycle states, merge/split/deprecation records, provenance, revision history, and structured entity participation.

## Dependencies
`src/server/repositories/event-repository.ts`, `app/milestone/[id]/[slug]/page.tsx`, root `MILESTONE_ARCHITECTURE.md`.

## Open Questions
- How are duplicate historical milestones merged?

## Future Evolution Guidance
Preserve event IDs and add explicit identity governance before large imports.
