# Data Canon

Authority Level: Canonical
Governed System: Implemented data model and future registry-driven data authority.
Describes: Both

## Scope
This document defines canonical data entities, relationship ownership, and data-quality assumptions.

## Non-Scope
This document does not provide every column definition; use `docs/references/DATABASE_SCHEMA.md` for that.

## Verified Implementation
Implemented core tables:
- `timelines`
- `events`
- `timeline_events`
- `sources`
- `event_sources`
- `tags`
- `event_tags`
- `timeline_requests`
- `timeline_slug_history`
- `analytics_events`
- `relationship_recovery_reports`
- `ad_campaigns`
- taxonomy governance tables for categories and tags.

Implemented invariants:
- Events are atomic knowledge units.
- Milestone URLs use stable event IDs.
- Timeline ordering is explicit through chronology or editorial ordering mode.
- Source and tag coverage must be relationship-backed.
- Timeline tags are derived from event tags.
- Timeline slug history supports permanent redirects.

## Future Architecture
Future system-of-record data must include:
- Canonical entity registry.
- Concept registry.
- Source document registry.
- Citation/provenance registry.
- Event relationship registry.
- Editorial revision registry.
- Import batch registry.
- Quality score registry.

## Dependencies
- `db/schema.sql`
- `db/migrations/*`
- `src/lib/types.ts`
- `src/server/repositories/*`
- `docs/data/*`

## Open Questions
- Should milestones have canonical merge/deprecation records?
- Should locations become first-class place entities?
- Should citations attach to event fields, claims, or both?

## Future Evolution Guidance
Do not treat dimension rows as coverage. Public evidence requires relationship rows and eventually claim-level provenance.
