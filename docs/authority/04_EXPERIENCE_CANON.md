# Experience Canon

Authority Level: Canonical
Governed System: Public, admin, search, discovery, and design experience boundaries.
Describes: Both

## Scope
This document defines the implemented experience model and future experience principles.

## Non-Scope
This document does not define CSS token details or component specs.

## Verified Implementation
Public experience:
- Homepage search and featured timeline feed.
- Infinite homepage timeline loading through `/api/homepage/timelines`.
- Timeline detail with vertical event stream, tags, sources count, ads, related timelines, sharing, and telemetry.
- Milestone pages with source and tag context.
- Search page with timeline and milestone results.
- Category and tag archive pages.

Admin experience:
- Hidden route controlled by `ADMIN_ROUTE_SLUG`.
- Token entered client-side and passed to admin APIs.
- Admin tabs for analytics, ads, and content operations.
- Import preview/execute and relationship recovery preview/apply are exposed in admin UI.

## Future Architecture
The future experience should make provenance, uncertainty, canonical identity, and editorial status legible without overwhelming public readers.

## Dependencies
- `components/timeline/*`
- `components/admin/*`
- `app/globals.css`
- `docs/design/*`

## Open Questions
- How should disputed milestones be displayed?
- Should public users see source credibility scores?
- Should factory-generated drafts have an internal review UI?

## Future Evolution Guidance
Keep public pages fast, readable, and citation-aware. Keep admin workflows explicit, auditable, and destructive-action-safe.
