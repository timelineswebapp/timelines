# Motion System

Authority Level: Design Foundation
Governed System: Motion and transitions.
Describes: Both

## Scope
Documents motion guidance.

## Non-Scope
Does not enumerate all CSS transitions.

## Verified Implementation
Motion is CSS/client behavior driven; event detail sheet and scrolling affordances use client state.

## Future Architecture
Define motion tokens for sheet open/close, hover, loading, and scroll cues.

## Dependencies
`components/timeline/EventDetailSheet.tsx`, `app/globals.css`.

## Open Questions
- What reduced-motion behavior is required?

## Future Evolution Guidance
Motion must be subtle and accessible.
