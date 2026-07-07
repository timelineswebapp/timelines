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

## Implementation Maturity Notes
The authority hierarchy above is unchanged by institutional certification.

As of 2026-07-07, TiMELiNES has a certified institutional publication path from source-backed discovery through the Public Platform. The institutional architecture is complete and certified with no architectural gaps. Production Launch Readiness is the active phase.

This maturity note does not change authority ordering: Factory Production Memory remains separate from Historical Library Published Memory, Governance remains the sole authority boundary for approval and publication-readiness decisions, and Historical Library remains the authority owner for Published Memory.

## Certification Ledger
| Certification | Current Status | Notes |
|---|---|---|
| `TL-PUBLICATION-CERTIFICATION-001` | Superseded historical failure | Preserved as historical evidence; no longer represents current publication status. |
| `TL-QWEN14-HISTORICAL-PRODUCTION-001` | Superseded by institutional certification | Valid early Factory runtime evidence. |
| Source Authority Foundation | Certified | External discovery, retrieval, immutable snapshots, versioning, and provenance. |
| Research Corpus and Evidence Foundation | Certified | Retrieved snapshots generate corpus documents and evidence records with lineage. |
| Evidence Validation Foundation | Certified | Structural evidence validation with validation provenance. |
| Governance Authority Hardening | Certified | Validated source-grounded evidence is required for authority-bearing decisions. |
| Telephone Institutional Certification | Institutionally Certified | Inaugural complete institutional publication subject. |
| Multi-Subject Institutional Certification | Certified | Printing Press, Steam Engine, Internet, and World Wide Web repeated the certified path. |
| Source Resilience Certification | Certified with minor defects | Provider retry, failover, cooldown, and stale snapshot provenance certified; provider health persistence remains planned. |
| Provider Adapter Hardening | Implemented and certified by later scale run | Provider response validation and diagnostics improved fresh-database acquisition. |
| Scale Certification | Certified | 25 and 50 subject batches passed at 100%; 100 subject batch passed at 98%. |
| Projection Slug Revalidation | Certified | Final known slug defects were corrected and revalidated. |
| Editorial Intelligence End-to-End | Certified | Complete Editorial Intelligence certification through EI-005. |
| Historical Library End-to-End | Certified | Complete Historical Library certification. |
| Published Memory End-to-End | Certified | Complete Published Memory certification. |
| Projection Engine End-to-End | Certified | Complete projection certification. |
| Search End-to-End | Certified | Complete Search certification. |
| Public Platform End-to-End | Certified | Complete public platform certification. |
| Institutional Completion Audit | Certified | Final institutional audit found no architectural gaps. |

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
