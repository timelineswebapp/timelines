# Quality Gates

Authority Level: Governance
Governed System: Release and publication quality gates.
Describes: Both

## Scope
Defines current and future gates.

## Non-Scope
Does not replace CI configuration.

## Verified Implementation
Available checks include lint, typecheck, build, import tests, data audit, and relationship backfill preview.

## Future Architecture
Publication gates must validate chronology, sources, tags, duplicates, provenance, lifecycle state, and editorial approval.

## Dependencies
`package.json`, `TIMELINE_QUALITY_SYSTEM.md`.

## Open Questions
- Which gates block deploy versus block publication only?

## Future Evolution Guidance
Failures must be visible and report-backed.
