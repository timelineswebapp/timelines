# Product Experience Canon V2

## Status
Status: Active starter product experience canon

Authority Level: Highest UX authority

Version: 2.0 starter

## Purpose
This document defines how TiMELiNES should feel, behave, and guide users through historical knowledge.

## Scope
This document governs:
- Public experience hierarchy.
- Navigation doctrine.
- Historical Context presentation.
- Historical Object page boundaries.
- Admin experience principles.
- Visual and interaction standards.

Out of scope:
- Database schema.
- API implementation.
- Factory and Historical Library operations.

## Authority
The experience hierarchy is:

```text
Timeline
  -> Milestone
    -> Historical Context
      -> Historical Object
```

Timeline and Milestone experiences must remain visually and behaviorally dominant. Historical Context is an enrichment layer. Historical Object pages are secondary reference surfaces.

## Ownership
Owner: Experience authority steward

Contributors:
- Product authority steward
- Architecture authority steward
- Engineering execution steward

## Principles
- Users should understand chronology before context.
- Context should explain meaning, not create browsing gravity.
- Participation display must include Object Name, Role, and Meaning.
- Priority determines context visibility and overflow before grouping.
- Grouping improves readability after priority selection.
- Object pages must route users back to milestones and timelines.
- Empty states must be graceful and truthful.
- Admin UI should expose workflows, not raw database concepts.

## Experience Locks
- Timeline pages remain primary public entry points.
- Milestone pages remain the primary detail surface.
- Historical Context appears only on approved surfaces.
- Object pages must not become discovery pages.
- Search and SEO expansion require separate authority.

## References
- `AUTHORITY_INDEX.md`
- `01_PRODUCT_CONSTITUTION_V2.md`
- `02_ARCHITECTURE_CANON_V2.md`
- `docs/architecture/WAVE_2_PRODUCT_MISSION.md`
- `docs/architecture/CONTEXT_EDITORIAL_MODEL.md`
- `docs/architecture/WAVE_2A_LOCK.md`

## Change Management
Experience changes must:
- State which hierarchy level is affected.
- Preserve chronology-first navigation.
- Include mobile and desktop behavior.
- Verify text fit, empty states, and overflow behavior.
- Avoid introducing discovery, graph, recommendation, or AI behavior without explicit authority.
