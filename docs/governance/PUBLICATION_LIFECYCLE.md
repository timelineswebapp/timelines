# Publication Lifecycle

Authority Level: Governance
Governed System: Publication states.
Describes: Both

## Scope
Defines current lifecycle gaps and future target states.

## Non-Scope
Does not change schema.

## Verified Implementation
Timelines and events do not have draft/published states. Existing rows are treated as public by repository reads and sitemap generation.

## Ownership Boundaries
This document is the primary authority for publication lifecycle policy.

- Publication states and approval rules: this document.
- Data representation of future states: `docs/data/PUBLICATION_STATE_MODEL.md`.
- Factory projection after approval: `docs/factory/PUBLICATION_PIPELINE.md`.
- SEO visibility effects: `docs/architecture/SEO_ARCHITECTURE.md`.

Factory documents cannot bypass publication governance.

## Future Architecture
Required states: `draft`, `in_review`, `approved`, `published`, `needs_revision`, `archived`, `deprecated`.

## Dependencies
`db/schema.sql`, `app/sitemap.ts`, public repository queries.

## Open Questions
- Should archived milestones remain resolvable?

## Future Evolution Guidance
Add lifecycle states before factory-generated content reaches public routes.
