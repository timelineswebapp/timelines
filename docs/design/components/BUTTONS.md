# Buttons

Authority Level: Design Component
Governed System: Button patterns.
Describes: Both

## Scope
Documents button usage.

## Non-Scope
Does not define button implementation.

## Verified Implementation
Buttons are CSS class-based in public and admin components, with variants such as secondary and danger.

## Future Architecture
Define variants, sizes, disabled/loading states, icon usage, and destructive action rules.

## Dependencies
`components/admin/*`, `app/globals.css`.

## Open Questions
- Should destructive actions require typed confirmation?

## Future Evolution Guidance
Buttons must clearly communicate operation risk.
