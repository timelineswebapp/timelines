# Design Tokens

Authority Level: Design
Governed System: Token documentation.
Describes: Both

## Scope
Defines current token documentation foundation.

## Non-Scope
Does not extract tokens from CSS automatically.

## Verified Implementation
Design tokens currently live primarily as CSS variables and class styles in `app/globals.css`.

## Future Architecture
Document tokens for color, typography, spacing, grid, motion, elevation, and component states.

## Dependencies
`app/globals.css`, `docs/design/foundations/*`.

## Open Questions
- Should tokens be shared with design tooling?

## Future Evolution Guidance
Keep tokens semantic, not page-specific.
