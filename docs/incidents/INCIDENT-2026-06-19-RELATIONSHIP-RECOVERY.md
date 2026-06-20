# INCIDENT-2026-06-19-RELATIONSHIP-RECOVERY

Authority Level: Incident Record
Governed System: Historical data integrity incident involving missing event-source and event-tag relationships.
Describes: Current Reality

## Classification Metadata
- Incident ID: `INCIDENT-2026-06-19-RELATIONSHIP-RECOVERY`
- Classification: Data integrity
- Severity: High
- Status: Closed
- Affected domains: source relationships, tag relationships, public citation coverage, public taxonomy coverage, search quality
- Primary evidence: production relationship counts and recovery output
- Historical record: preserve facts; do not reinterpret counts without a follow-up audit

## Scope
This incident record documents the historical production data integrity incident where event-source and event-tag relationship rows were missing and later recovered.

## Non-Scope
This incident record does not modify data, define a new recovery process, or assign code-level root cause beyond the preserved historical facts.

## Summary

Relationship links between events and tags/sources were missing in production.

Affected tables:
- event_tags
- event_sources

## Impact

- event_tags = 0
- event_sources = 0

while:
- events = 13,142
- tags = 5,854
- sources = 2,686

## Recovery

Recovered relationships from canonical CSV archive in /data.

Results:
- 32,663 event_tags restored
- 12,359 event_sources restored

## Validation

Post-recovery:

- event_tags = 32,663
- event_sources = 12,359
- orphan relationships = 0
- ambiguous matches = 0

## Remaining

826 unmatched CSV rows requiring separate data-quality review.

## Incident Lifecycle
- Detected: relationship counts showed `event_tags = 0` and `event_sources = 0`.
- Diagnosed: dimension rows existed but relationship rows were absent.
- Recovered: relationships were recovered from canonical CSV archive in `/data`.
- Validated: recovered counts were checked for orphan relationships and ambiguous matches.
- Closed: incident status is closed with unmatched CSV rows retained for separate review.

## Root Cause
Relationship rows were missing while event, tag, and source dimension rows existed. The incident record does not prove a single code-level cause. The documented systemic cause is that dimension rows were insufficiently protected as non-evidence without corresponding relationship rows.

## Lessons Learned
- Source and tag coverage must be measured by relationship tables, not dimension table counts.
- Relationship recovery must be additive, audited, and source-artifact-backed.
- Import and repair workflows must verify `event_sources` and `event_tags` counts after execution.
- Data quality monitors should alert when public relationship coverage collapses.

## Dependencies
- `SOURCE_AUTHORITY.md`
- `TAXONOMY_ARCHITECTURE.md`
- `TIMELINE_QUALITY_SYSTEM.md`
- `docs/data/RELATIONSHIP_MODEL.md`
- `docs/operations/INCIDENT_RESPONSE.md`
- `docs/operations/MONITORING.md`

## Open Questions
- What follow-up disposition is required for the 826 unmatched CSV rows?
- Should relationship coverage thresholds become a production monitor?

## Future Evolution
Future incident records should use this metadata format and include severity, lifecycle, root cause, validation, lessons learned, and unresolved follow-ups.

## Status

Closed.
