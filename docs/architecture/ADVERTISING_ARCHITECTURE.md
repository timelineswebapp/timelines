# Advertising Architecture

Authority Level: Architecture
Governed System: Ad campaign model and public ad placement.
Describes: Both

## Scope
Documents current ads implementation.

## Non-Scope
Does not define ad sales policy.

## Verified Implementation
Ad campaigns are stored in `ad_campaigns`. Slots are fixed enum values. Active campaigns are selected by slot, status, date range, and latest update. Public placements render in homepage, timelines, and search.

## Future Architecture
Ad delivery should include auditable impression/click tracking, pacing, creative review, and policy enforcement.

## Dependencies
`src/server/repositories/ads-repository.ts`, `src/server/services/ads-service.ts`, `components/timeline/AdSlot.tsx`.

## Open Questions
- What ad policy prevents conflicts with historical content?

## Future Evolution Guidance
Do not expose unreviewed creatives on public pages.
