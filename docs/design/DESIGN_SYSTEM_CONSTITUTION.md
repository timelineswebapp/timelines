# Design System Constitution

Authority Level: Design
Governed System: Design system direction.
Describes: Both

## Scope
Defines design principles for TiMELiNES.

## Non-Scope
Does not replace CSS source.

## Verified Implementation
The implemented UI uses Apple Liquid Glass-inspired panels, clean typography, vertical timeline presentation, and responsive layouts.

## Ownership Boundaries
This document is the primary design authority.

- Design principles: this document and `docs/design/DESIGN_PRINCIPLES.md`.
- Tokens: `docs/design/DESIGN_TOKENS.md`.
- Foundation systems: `docs/design/foundations/*`.
- Component standards: `docs/design/components/*` and `docs/design/COMPONENT_STATE_STANDARD.md`.
- Accessibility: `docs/design/accessibility/*`.
- Brand: `docs/design/brand/BRAND_FOUNDATION.md`.

Lower-level design docs must conform to this constitution.

## Future Architecture
The design system should document tokens, components, patterns, accessibility, and historical reading principles.

## Dependencies
`app/globals.css`, `components/ui/*`, `components/timeline/*`.

## Open Questions
- Should tokens be extracted to TypeScript/CSS variables with documentation generation?

## Future Evolution Guidance
Design must serve historical clarity before decoration.
