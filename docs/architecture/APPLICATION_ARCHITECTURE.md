# Application Architecture

Authority Level: Architecture
Governed System: Application layer structure.
Describes: Both

## Scope
Documents app, component, API, service, and repository boundaries.

## Non-Scope
Does not specify future service infrastructure.

## Verified Implementation
- `app/`: routes and pages.
- `components/`: UI.
- `src/lib/`: shared types, metadata, chronology, utilities.
- `src/server/services/`: orchestration.
- `src/server/repositories/`: persistence.
- `src/server/validation/`: Zod schemas.

## Future Architecture
Add registry/factory boundaries as separate modules or services before introducing automation.

## Dependencies
`docs/authority/02_ARCHITECTURE_CANON.md`.

## Open Questions
- What module owns future registry projections?

## Future Evolution Guidance
Maintain backend ownership of persistence.
