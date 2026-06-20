# Color System

Authority Level: Design Foundation
Governed System: Color usage.
Describes: Both

## Scope
Documents color foundation.

## Non-Scope
Does not list every CSS value.

## Verified Implementation
Color implementation is CSS-based in `app/globals.css` with glass surfaces, muted text, accent pills, and category theming.

## Future Architecture
Define semantic tokens for background, surface, text, border, accent, status, danger, and ad treatments.

## Dependencies
`app/globals.css`, `src/lib/categoryTheme.ts`.

## Open Questions
- What formal contrast thresholds apply to glass surfaces?

## Future Evolution Guidance
Audit contrast before adding new palettes.
