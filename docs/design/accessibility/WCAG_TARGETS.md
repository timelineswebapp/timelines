# WCAG Targets

Authority Level: Design Accessibility
Governed System: Accessibility compliance target and verification expectations.
Describes: Future Architecture

## Scope
This document defines the future accessibility target for TiMELiNES.

## Non-Scope
This document does not certify the current application as compliant.

## Current Reality
The current docs note semantic links, buttons, labels, and aria labels in several surfaces. No formal WCAG target or automated accessibility gate is documented as implemented.

## Future Architecture
TiMELiNES should target WCAG 2.2 AA for public and admin experiences unless a stricter standard is adopted.

## Verification Expectations
- Keyboard navigation for interactive flows.
- Visible focus states.
- Sufficient contrast on glass surfaces.
- Reduced-motion support.
- Screen-reader labels for icon-only actions.
- Form validation messages tied to fields.

## Dependencies
- `docs/design/accessibility/ACCESSIBILITY_STANDARD.md`
- `docs/design/COMPONENT_STATE_STANDARD.md`
- `app/globals.css`
- `components/*`

## Open Questions
- Which accessibility test runner should be added to CI?
- What manual QA checklist is required before release?

## Future Evolution
Convert this target into automated and manual release gates after tooling is selected.
