# Import Architecture

Authority Level: Architecture
Governed System: Bulk content ingestion.
Describes: Both

## Scope
Documents current import behavior and future batch requirements.

## Non-Scope
Does not replace root `IMPORT_ARCHITECTURE.md`; this file anchors it inside the docs library.

## Verified Implementation
Import preview and execute are implemented in `src/server/services/import-service.ts`. Supported formats are CSV, JSON, and text. Supported modes are `timeline_with_events` and `events_into_existing_timeline`. Execute writes in a transaction.

## Ownership Boundaries
This document is the primary authority for implemented import architecture and the import service boundary.

- Current import behavior: this document.
- CSV column reference: `docs/references/CSV_IMPORT_SPEC.md`.
- Future durable import batch records: `docs/factory/IMPORT_BATCH_MODEL.md`.
- Future factory audit requirements: `docs/factory/FACTORY_AUDIT_MODEL.md`.
- Publication approval policy: `docs/governance/PUBLICATION_LIFECYCLE.md`.

When these documents conflict, current implementation facts in this document and source code win for existing behavior. Factory documents govern only future architecture until implemented.

## Future Architecture
Imports should become durable batches with checksum, operator, approval, row-level reports, and rollback metadata.

## Dependencies
`src/server/services/import-service.ts`, `app/api/admin/import/*`, root `IMPORT_ARCHITECTURE.md`.

## Open Questions
- Where should import batch artifacts be stored?

## Future Evolution Guidance
Never add write imports without preview and persisted audit.
