# Product Constitution V2

## Status
Status: Active starter product constitution

Authority Level: Highest product authority

Version: 2.0 starter

## Purpose
This constitution defines the product identity, non-negotiable doctrine, and strategic boundaries of TiMELiNES. It exists to keep product decisions aligned as the platform grows.

## Scope
This document governs:
- Product identity.
- Platform purpose.
- Product doctrine.
- Capability boundaries.
- Strategic product exclusions.
- Interpretation of user-facing platform behavior.

Out of scope:
- Database schema details.
- Component implementation.
- Operational runbooks.
- Temporary launch plans.

## Authority
TiMELiNES is a Chronological Knowledge Platform.

The authoritative product hierarchy is:

```text
Timeline View
  -> Milestone
    -> Historical Context
      -> Historical Object
```

Product interpretation rule: chronology remains the primary organizing principle. Any feature that competes with chronology requires explicit constitutional approval.

## Ownership
Owner: Product authority steward

Contributors:
- Architecture authority steward
- Experience authority steward
- Data/schema authority steward

## Principles
- Chronology is the primary product structure.
- Milestones are the canonical chronological knowledge unit.
- Timeline Views provide narrative.
- Historical Context enriches chronology.
- Historical Objects provide context and remain secondary surfaces.
- Participation provides historical meaning.
- Search, discovery, graph, intelligence, and AI features must not dilute chronology-first identity.
- Public experience must privilege understanding over browsing volume.

## Product Locks
- Timeline-first navigation is the default.
- Milestone detail is the primary knowledge surface.
- Context must explain why a milestone matters.
- Historical Object pages must route users back toward chronology.
- TiMELiNES must not become an encyclopedia, entity directory, graph explorer, recommendation engine, or AI-first product without formal product authority change.

## References
- `AUTHORITY_INDEX.md`
- `02_ARCHITECTURE_CANON_V2.md`
- `04_PRODUCT_EXPERIENCE_CANON_V2.md`
- `06_PERMANENT_CONTEXT_V2.md`
- `docs/architecture/PLATFORM_CAPABILITIES.md`
- `docs/architecture/WAVE_2A_LOCK.md`

## Change Management
Changes require product authority review and must document:
- Product doctrine affected.
- User-facing behavior affected.
- Capability boundary affected.
- Whether chronology-first identity remains intact.

No implementation program may override this constitution by implication.
