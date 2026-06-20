# Product Scope

Authority Level: Product
Governed System: Product boundaries.
Describes: Both

## Scope
Defines current and future product boundaries.

## Non-Scope
Does not define engineering implementation details.

## Verified Implementation
In scope today: public timelines, milestones, search, tags, categories, timeline requests, admin content management, imports, relationship recovery, analytics, ads.

Out of current implementation: public accounts, public authoring, roles, payments, subscriptions, LLM timeline generation, graph browsing.

## Future Architecture
Future scope includes governed factory production, entity/concept registries, provenance-rich graph data, and editorial review workflows.

## Dependencies
`app/*`, `components/admin/*`, `src/server/services/*`.

## Open Questions
- Should all timelines remain free/public?
- What admin personas exist?

## Future Evolution Guidance
Do not add broad user-facing creation until publication and provenance governance exist.
