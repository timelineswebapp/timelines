# Search Experience

Authority Level: Design Pattern
Governed System: Search UX.
Describes: Both

## Scope
Documents search behavior and presentation.

## Non-Scope
Does not define ranking algorithms.

## Verified Implementation
Search accepts a query, routes to `/search?q=...`, and displays timeline and milestone result cards.

## Future Architecture
Add filters for entity, concept, period, source status, and content type after registries exist.

## Dependencies
`components/forms/SearchBar.tsx`, `app/search/page.tsx`.

## Open Questions
- Should no-result searches create requests?

## Future Evolution Guidance
Search must remain bounded and responsive.
