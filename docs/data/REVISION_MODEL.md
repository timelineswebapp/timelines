# Revision Model

Authority Level: Data
Governed System: Future revision and audit data model.
Describes: Both

## Scope
This document defines current revision limitations and future revision data expectations.

## Non-Scope
This document does not modify current update behavior.

## Current Reality
Only timeline slug history is implemented as durable historical metadata. Content revisions for timelines, events, sources, tags, imports, and admin actions are not persisted as general revision records.

## Future Architecture
Revision records should preserve entity type, entity ID, actor, operation, previous value, new value, reason, approval reference, timestamp, and rollback link.

## Revision Ownership
- Governance owns policy.
- Data owns structure.
- Operations owns rollback procedure.
- Factory owns batch-level audit artifacts.

## Dependencies
- `docs/governance/REVISION_HISTORY_POLICY.md`
- `docs/operations/ROLLBACK_POLICY.md`
- `docs/factory/FACTORY_AUDIT_MODEL.md`
- `timeline_slug_history`

## Open Questions
- Should revisions be append-only?
- Which changes are material enough to require approval?

## Future Evolution
Revision storage should be added before multi-editor or factory publication workflows.
