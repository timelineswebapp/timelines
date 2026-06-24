# Schema Canon V2

## Status
Status: Active starter schema canon

Authority Level: Highest data-model authority

Version: 2.0 starter

## Purpose
This document defines canonical data-model ownership, persistence doctrine, and schema authority rules for TiMELiNES.

## Scope
This document governs:
- Canonical entities.
- Authority ownership.
- Persistence expectations.
- Lifecycle and revision doctrine.
- Public read-model boundaries.
- Data integrity and migration principles.

Out of scope:
- UI layout.
- Product copy.
- Operational staffing.
- Temporary seed data.

## Authority
Canonical data ownership:

| Domain | Owner | Notes |
|---|---|---|
| Timeline Views | Chronology platform | Narrative projections over milestones. |
| Milestones | Chronology authority | Canonical chronological knowledge units. |
| Historical Objects | Historical Object Registry | Durable historical identity. |
| Participation | Historical Authority | Meaning between objects and milestones. |
| Sources | Evidence authority | Source links and credibility. |
| Source Authority Records | Source Authority | Externally discovered provider source records and source origin provenance. |
| Source Authority Snapshots | Source Authority | Immutable retrieved source snapshots, snapshot versions, retrieval provenance, and stale-source provenance when reused. |
| Corpus Documents | Research Corpus | Normalized documents derived from retrieved source snapshots. |
| Evidence Records | Evidence foundation | Evidence spans linked to corpus documents, source snapshots, source authority records, providers, and retrieval timestamps. |
| Evidence Validation Records | Evidence validation | Structural validation records and validation provenance; non-authoritative. |
| Governance Packages and Decisions | Governance | Publication packages, review decisions, readiness certification, library review, and acceptance lifecycle. |
| Tags/Categories | Taxonomy authority | Discovery and classification support. |
| Published Memory | Historical Library | Historical Library authority; Factory must treat it as outside Factory Production Memory. |
| Production Memory | Factory | Factory authority for candidate objects, artifacts, pipeline runs, and pipeline steps before Governance approval. |
| Projections | Platform read-model layer | Timeline, search, sitemap, and public-route read models derived from Published Memory. |

## Ownership
Owner: Data/schema authority steward

Contributors:
- Architecture authority steward
- Product authority steward
- Engineering execution steward

## Principles
- Data models must have explicit authority ownership.
- Public read models must not become mutation models.
- Authority history must be reconstructable.
- No-delete doctrine applies to historical authority records.
- Lifecycle transitions must be deterministic.
- UUID-backed route parameters must be validated before repository execution.
- Migrations must be additive when preserving production data.
- Query paths for public pages must be bounded.

## Canonical Entity Rules
- Milestones own chronology.
- Timeline Views own narrative arrangement.
- Historical Objects own identity.
- Participation owns meaning.
- Historical Library owns Published Memory.
- Factory owns Production Memory.
- Governance owns publication readiness, library review, and authority-bearing decisions.
- Platform presents published read models derived from Historical Library Published Memory.

## References
- `AUTHORITY_INDEX.md`
- `01_PRODUCT_CONSTITUTION_V2.md`
- `02_ARCHITECTURE_CANON_V2.md`
- `docs/architecture/DOMAIN_MODEL.md`
- `docs/constitution/HISTORICAL_OBJECT_CONSTITUTION.md`
- `docs/constitution/HISTORICAL_LIBRARY_CONSTITUTION.md`
- `db/schema.sql`

## Change Management
Schema changes must:
- Identify authority owner.
- Include migration path.
- Preserve existing public behavior unless explicitly authorized.
- Include validation and repository updates.
- Include tests for lifecycle, revision, reconstruction, and compatibility where relevant.
