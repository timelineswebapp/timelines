# Source Credibility Policy

Authority Level: Governance
Governed System: Source credibility interpretation.
Describes: Both

## Scope
Defines current score use and future credibility policy.

## Non-Scope
Does not rank publishers.

## Verified Implementation
Sources have `credibility_score` bounded between 0 and 1. Milestone pages display confidence percentage.

## Future Architecture
Define source classes, minimum credibility thresholds, peer-review status, primary/secondary source treatment, and rejected-source handling.

## Dependencies
`db/schema.sql`, `app/milestone/[id]/[slug]/page.tsx`, `src/server/validation/schemas.ts`.

## Open Questions
- What score maps to publication eligibility?

## Future Evolution Guidance
Credibility must be explainable, not only numeric.
