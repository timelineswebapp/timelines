# Analytics Architecture

Authority Level: Architecture
Governed System: Telemetry and admin analytics.
Describes: Both

## Scope
Documents implemented analytics.

## Non-Scope
Does not define GA reporting strategy.

## Verified Implementation
Timeline views are recorded in `analytics_events` through `/api/telemetry/timeline-view`. Events are deduped by slug and session ID within 30 minutes. Admin analytics reads aggregate timeline views and request/content metrics.

## Future Architecture
Analytics should track search quality, source interactions, graph navigation, factory throughput, and editorial SLA without collecting unnecessary personal data.

## Dependencies
`app/api/telemetry/timeline-view/route.ts`, `src/server/repositories/analytics-events-repository.ts`, `src/server/repositories/analytics-repository.ts`.

## Open Questions
- Should ad clicks and impressions be recorded server-side?

## Future Evolution Guidance
Keep analytics privacy-bounded and operationally useful.
