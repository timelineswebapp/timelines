# CSV Import Spec

Authority Level: Reference
Governed System: Current CSV import contract.
Describes: Both

## Scope
Documents import CSV columns.

## Non-Scope
Does not replace parser tests.

## Verified Implementation
Canonical columns include `timeline_title`, `timeline_slug`, `timeline_description`, `category`, `event_order`, `date`, `date_precision`, `title`, `description`, `importance`, `location`, `image_url`, `source_publisher`, `source_url`, `source_credibility`, `tags`.

Tags split on semicolon, comma, and pipe. Source URLs may receive `https://` when safe.

## Future Architecture
CSV imports should become one source artifact type under durable import batches.

## Dependencies
`src/server/services/import-service.ts`, `src/server/services/import-service.test.ts`.

## Open Questions
- Should multiple sources per row be supported?

## Future Evolution Guidance
Any alias or column change requires tests and docs update.
