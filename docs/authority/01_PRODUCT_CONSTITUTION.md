# Product Constitution

Authority Level: Constitutional
Governed System: TiMELiNES product mission, scope, and product-grade decision rules.
Describes: Both

## Scope
This document governs what TiMELiNES is allowed to become and what product tradeoffs are acceptable.

## Non-Scope
This document does not define database schema, UI component implementation, or operational runbooks.

## Verified Implementation
TiMELiNES publishes structured timelines and canonical milestone pages. The current platform includes:
- Homepage discovery and search.
- Timeline detail pages at `/timeline/{slug}`.
- Milestone pages at `/milestone/{eventId}/{slug}`.
- Category and tag archive pages.
- Public timeline request submission.
- Hidden admin dashboard for content, analytics, ads, import, taxonomy, data health, and requests.

The current product is curated-content first. There is no implemented user account system, public authoring workflow, or LLM-generated publication workflow.

## Future Architecture
The product should become a historical data platform whose primary asset is historical data, not software. The software must support:
- Provenance-first historical content.
- Canonical milestone identity.
- Registry-driven rebuildability.
- Editorial governance before automation.
- Factory production only when quality gates are enforceable.

## Product Principles
- Data quality outranks generation speed.
- Provenance outranks volume.
- Reproducibility outranks convenience.
- Canonical authority outranks automation.
- Publishing databases are rebuild targets, not permanent authority stores.

## Dependencies
- `docs/product/*`
- `docs/data/*`
- `docs/governance/*`
- `app/page.tsx`
- `app/timeline/[slug]/page.tsx`
- `app/milestone/[id]/[slug]/page.tsx`

## Open Questions
- What is the minimum evidence standard for a public milestone?
- Should every database timeline be publicly visible?
- What product surface exposes disputes or uncertainty?

## Future Evolution Guidance
Before adding automated content generation, define publication lifecycle, source credibility policy, provenance requirements, and rollback-safe import batches.
