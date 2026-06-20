# Permanent Context

Authority Level: Persistent Context
Governed System: Long-lived engineering context that should survive handoffs and rebuilds.
Describes: Both

## Scope
This document preserves stable facts and unresolved gaps that every future engineer should know.

## Non-Scope
This document is not a changelog or release note.

## Verified Implementation
- TiMELiNES is currently a curated publishing platform.
- PostgreSQL/Neon is the runtime publishing database.
- Events are canonical public milestones.
- Relationship tables are critical: `timeline_events`, `event_sources`, `event_tags`.
- Chronology parsing is centralized.
- Admin is token-based, not role-based.
- Public search is PostgreSQL full-text plus tag/event joins.
- Timeline view telemetry exists; ad click/impression telemetry routes are not implemented.
- Root-level authority docs exist for chronology, import, milestones, source authority, taxonomy, and quality.

## Future Architecture
The permanent direction is registry-driven historical knowledge infrastructure:
- Registries and source artifacts rebuild publishing state.
- Milestones become canonical, mergeable, deprecatable historical records.
- Sources and citations become claim-level.
- Factory production is governed by quality gates, not generation speed.

## Dependencies
- `docs/authority/*`
- Existing root Markdown authority docs.
- Full repository source.

## Open Questions
- Which artifacts become permanent system of record?
- What is the governance process for canonical milestone identity?
- How will disputes be stored and presented?

## Future Evolution Guidance
When implementation catches up to future architecture, move facts from future sections into verified implementation sections and cite supporting files.
