# Authority Index

## Status
Status: Active starter authority registry

Version: 2.0 starter

Last Updated: June 2026

## Purpose
This document is the top-level authority registry for the TiMELiNES project knowledge library. It identifies the canonical authority documents, their hierarchy, their ownership domains, and the rules for resolving conflicts between documents.

## Scope
This index governs the documents stored in `Knowledge/` and their relationship to existing product, architecture, schema, experience, execution, and institutional-memory authorities.

Out of scope:
- Runtime configuration.
- Source code implementation details except where linked by canon.
- Temporary planning notes that have not been accepted into this authority library.

## Authority
Authority Level: Top-level authority registry

Conflict resolution:
1. `01_PRODUCT_CONSTITUTION_V2.md` governs product identity and doctrine.
2. `02_ARCHITECTURE_CANON_V2.md` governs system architecture.
3. `03_SCHEMA_CANON_V2.md` governs data-model ownership and persistence doctrine.
4. `04_PRODUCT_EXPERIENCE_CANON_V2.md` governs public and administrative experience doctrine.
5. `05_EXECUTION_CANON_V2.md` governs engineering execution rules.
6. `06_PERMANENT_CONTEXT_V2.md` governs long-lived project context and institutional memory.

When domain-specific documents conflict, the document with direct domain ownership wins. Product doctrine remains the highest interpretive authority for platform identity.

## Ownership
Owner: Project authority maintainers

Stewards:
- Product authority steward
- Architecture authority steward
- Data/schema authority steward
- Experience authority steward
- Engineering execution steward
- Institutional memory steward

## Principles
- Authority must be explicit, versioned, and traceable.
- Canon documents must preserve TiMELiNES as a Chronological Knowledge Platform.
- Authority changes require deliberate review, not incidental edits.
- Documents should clarify ownership boundaries before implementation begins.
- Canon should be concise enough to apply and complete enough to govern.

## Document Registry
| Document | Authority Role | Owner | Status |
|---|---|---|---|
| `01_PRODUCT_CONSTITUTION_V2.md` | Highest product authority | Product authority steward | Active starter |
| `02_ARCHITECTURE_CANON_V2.md` | Highest architecture authority | Architecture authority steward | Active starter |
| `03_SCHEMA_CANON_V2.md` | Highest data-model authority | Data/schema authority steward | Active starter |
| `04_PRODUCT_EXPERIENCE_CANON_V2.md` | Highest UX authority | Experience authority steward | Active starter |
| `05_EXECUTION_CANON_V2.md` | Highest engineering authority | Engineering execution steward | Active starter |
| `06_PERMANENT_CONTEXT_V2.md` | Highest long-term context authority | Institutional memory steward | Active starter |

## References
- `01_PRODUCT_CONSTITUTION_V2.md`
- `02_ARCHITECTURE_CANON_V2.md`
- `03_SCHEMA_CANON_V2.md`
- `04_PRODUCT_EXPERIENCE_CANON_V2.md`
- `05_EXECUTION_CANON_V2.md`
- `06_PERMANENT_CONTEXT_V2.md`
- `docs/architecture/PLATFORM_CAPABILITIES.md`
- `docs/architecture/DOMAIN_MODEL.md`
- `docs/constitution/HISTORICAL_OBJECT_CONSTITUTION.md`
- `docs/constitution/HISTORICAL_LIBRARY_CONSTITUTION.md`

## Change Management
Changes to this index must:
- Preserve the authority hierarchy.
- Update document status and ownership when responsibility changes.
- Add new canonical documents only when their ownership boundary is clear.
- Record meaningful changes in the affected canon document.
- Avoid duplicating temporary plans as permanent authority.
