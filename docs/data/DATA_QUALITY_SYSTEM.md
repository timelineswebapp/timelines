# Data Quality System

Authority Level: Data
Governed System: Data quality checks and remediation.
Describes: Both

## Scope
Defines current quality posture.

## Non-Scope
Does not implement checks.

## Verified Implementation
Quality documentation exists in root `TIMELINE_QUALITY_SYSTEM.md`. Scripts exist for data audit/repair and relationship backfill. Relationship recovery reports persist counts and rows.

## Future Architecture
Persist per-record quality status for timelines, milestones, sources, tags, citations, and factory batches.

## Dependencies
`TIMELINE_QUALITY_SYSTEM.md`, `scripts/check-and-fix-data.ts`, `scripts/backfill-event-relationships.ts`.

## Open Questions
- What quality score blocks publication?

## Future Evolution Guidance
Quality gates must be deterministic, reportable, and dry-run capable.
