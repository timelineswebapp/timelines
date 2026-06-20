# Publication State Model

Authority Level: Data
Governed System: Future publication state data model for public content.
Describes: Both

## Scope
This document defines how publication state should be represented in future data models.

## Non-Scope
This document does not claim publication state exists today or modify schema.

## Current Reality
Timelines and events do not have draft, review, published, archived, or deprecated fields. Repository reads and sitemap generation treat persisted timelines/events as public.

## Future Architecture
Publication state should be explicit for timelines, milestones, claims, sources, concepts, and graph relationships where public visibility matters.

## Candidate States
- `draft`
- `in_review`
- `approved`
- `published`
- `needs_revision`
- `archived`
- `deprecated`

## Dependencies
- `docs/governance/PUBLICATION_LIFECYCLE.md`
- `docs/factory/PUBLICATION_PIPELINE.md`
- `docs/architecture/SEO_ARCHITECTURE.md`
- `app/sitemap.ts`

## Open Questions
- Should source records have independent publication states?
- Should archived records remain publicly resolvable?

## Future Evolution
Publication state must be added before unreviewed factory output can be stored beside public content.
