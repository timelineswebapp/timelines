# Navigation

Authority Level: Design Component
Governed System: Navigation components.
Describes: Both

## Scope
Documents navigation patterns.

## Non-Scope
Does not define routing internals.

## Verified Implementation
Site header/footer, search forms, category/tag links, timeline related links, and admin tabs provide navigation.

## Future Architecture
Add registry/graph navigation patterns after entities and concepts exist.

## Dependencies
`components/layout/*`, `components/admin/AdminTabs.tsx`.

## Open Questions
- Should graph navigation appear on milestone pages?

## Future Evolution Guidance
Navigation should expose context without distracting from reading.
