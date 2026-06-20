# Authority Index

Authority Level: Constitutional
Governed System: Documentation authority, source-of-truth hierarchy, and platform ownership boundaries.
Describes: Both

## Scope
This document defines the canonical map of TiMELiNES authorities. It is the first document a senior engineer should read before changing data, code, operations, or editorial workflows.

## Non-Scope
This document does not define implementation details for individual APIs, schemas, UI components, or future registries.

## Verified Implementation
- The implemented platform is a Next.js 14 App Router application backed by PostgreSQL through repository modules.
- Database structure is defined in `db/schema.sql` with migrations in `db/migrations/`.
- Server-side data access is owned by `src/server/repositories/*`.
- Public content reads are coordinated by `src/server/services/content-service.ts`.
- Admin operations are coordinated by `src/server/services/admin-service.ts` and protected by `src/server/api/admin-auth.ts`.
- Input validation is centralized in `src/server/validation/schemas.ts`.
- Chronology authority is centralized in `src/lib/historical-date.ts`.
- Import authority is implemented in `src/server/services/import-service.ts`.
- Relationship recovery authority is implemented in `src/server/services/relationship-recovery-service.ts`.
- Events are the atomic milestone unit. Timelines connect to events through `timeline_events`.
- Sources and tags become public evidence only through `event_sources` and `event_tags`.

## Future Architecture
TiMELiNES should evolve toward a registry-driven historical knowledge platform where authoritative registries and source artifacts can rebuild the publishing database. Neon remains the publishing target, not the permanent system of record.

Future authorities must include:
- Canonical entity registry authority.
- Concept registry authority.
- Source document and citation authority.
- Publication lifecycle authority.
- Editorial review and audit authority.
- Import batch and factory run authority.
- Knowledge graph relationship authority.

## Authority Map
- Product: `docs/authority/01_PRODUCT_CONSTITUTION.md`
- Architecture: `docs/authority/02_ARCHITECTURE_CANON.md`
- Data: `docs/authority/03_DATA_CANON.md`
- Experience: `docs/authority/04_EXPERIENCE_CANON.md`
- Execution: `docs/authority/05_EXECUTION_CANON.md`
- Permanent context: `docs/authority/06_PERMANENT_CONTEXT.md`

## Authority Precedence
When documentation conflicts, use this order:

1. `docs/authority/*` constitutional and canonical documents.
2. Domain authorities: `docs/product/*`, `docs/architecture/*`, `docs/data/*`, `docs/governance/*`, `docs/operations/*`.
3. Production workflow authorities: `docs/factory/*` and `docs/graph/*`, but only for future-state systems until implementation exists.
4. Design authorities: `docs/design/*` for UI, accessibility, brand, component, and pattern decisions.
5. Reference documents: `docs/references/*` for summaries of implemented contracts.
6. Audit, incident, and decision records: `docs/audits/*`, `docs/incidents/*`, and `docs/decisions/*` as historical evidence and decision history.
7. Root-level legacy authority documents remain valid evidence until their content is migrated or superseded by a docs-library authority.

## Conflict Resolution Rules
- Current implementation facts win over future architecture claims.
- `db/schema.sql` and migrations win over schema summaries.
- Source code wins over reference summaries when documenting implemented behavior.
- Constitutional authority wins over domain-level preference.
- Governance documents win over factory documents for approval, publication, editorial, and dispute policy.
- Data documents win over graph documents for current tables and relationships.
- Graph documents win only for future ontology, typed relationship, and registry design.
- Operations documents win for deploy, migration, rollback, secrets, monitoring, and incident response.
- Design system constitution wins over component and pattern docs for visual principles.
- References are descriptive, not governing, when they conflict with authority documents.

## Duplicate Authority Boundaries
- Import: `docs/architecture/IMPORT_ARCHITECTURE.md` owns current import behavior; `docs/factory/IMPORT_BATCH_MODEL.md` owns future durable batch shape; `docs/references/CSV_IMPORT_SPEC.md` owns current CSV column reference.
- Relationship: `docs/data/RELATIONSHIP_MODEL.md` owns current relationship tables; `docs/graph/RELATIONSHIP_AUTHORITY.md` owns future typed graph edges.
- Source: `docs/data/SOURCE_MODEL.md` owns current `sources` and `event_sources`; `docs/graph/SOURCE_REGISTRY.md` owns future source document registry; `docs/governance/SOURCE_CREDIBILITY_POLICY.md` owns credibility policy.
- Milestone: `docs/data/MILESTONE_MODEL.md` owns current event-as-milestone data; `docs/graph/MILESTONE_REGISTRY.md` owns future canonical milestone registry.
- Publication: `docs/governance/PUBLICATION_LIFECYCLE.md` owns publication states; `docs/factory/PUBLICATION_PIPELINE.md` owns future factory projection after approval.
- Design: `docs/design/DESIGN_SYSTEM_CONSTITUTION.md` owns design principles; foundation/component/pattern docs own lower-level usage.

## Dependencies
- `AGENTS.md`
- `README.md`
- `db/schema.sql`
- `src/lib/types.ts`
- `src/server/services/*`
- `src/server/repositories/*`
- Existing root authority documents.

## Open Questions
- Which registry format becomes the future system of record: database tables, versioned files, or both?
- What role model should replace single-token admin access?
- What minimum provenance depth is required before factory publication?

## Future Evolution Guidance
Every major code or data change must update the authority document for the affected domain. Future docs must preserve the distinction between implemented reality and target architecture.
