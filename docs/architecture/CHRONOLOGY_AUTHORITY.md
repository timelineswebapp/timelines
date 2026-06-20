# Chronology Authority

Authority Level: Architecture
Governed System: Historical date parsing and ordering.
Describes: Both

## Scope
Documents chronology ownership.

## Non-Scope
Does not replace root `CHRONOLOGY_AUTHORITY.md`; this file points engineers to the implemented parser.

## Verified Implementation
Chronology parsing is implemented in `src/lib/historical-date.ts`. Events store legacy date, display date, precision, and sort fields. Ordering modes are `chronology` and `editorial`.

## Future Architecture
Future chronology registries should handle eras, reigns, periods, disputed dates, date ranges, and confidence.

## Dependencies
`src/lib/historical-date.ts`, root `CHRONOLOGY_AUTHORITY.md`.

## Open Questions
- How should date ranges be represented?

## Future Evolution Guidance
Do not add ad hoc date parsing.
