# INCIDENT-2026-06-19-RELATIONSHIP-RECOVERY

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

## Status

Closed.
