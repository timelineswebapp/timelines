# Component State Standard

Authority Level: Design
Governed System: Component state documentation and interaction consistency.
Describes: Both

## Scope
This document governs how UI component states should be documented and evaluated.

## Non-Scope
This document does not modify component code or CSS.

## Current Reality
Components implement states through local React state, CSS classes, disabled attributes, modal state, status messages, and conditional rendering. No formal component state matrix exists.

## Future Architecture
Every reusable component should define default, hover, focus, active, disabled, loading, empty, error, success, destructive, and reduced-motion states where applicable.

## State Requirements
- State must be visually distinguishable.
- State must be accessible by keyboard where interactive.
- Loading and error states must not shift layout unnecessarily.
- Destructive states must communicate risk.

## Dependencies
- `docs/design/DESIGN_SYSTEM_CONSTITUTION.md`
- `docs/design/accessibility/ACCESSIBILITY_STANDARD.md`
- `components/*`
- `app/globals.css`

## Open Questions
- Which components are considered design-system primitives?
- Should state matrices be stored per component doc?

## Future Evolution
Add state tables to component docs before formalizing a component library.
