# TL-KF-V2-000 — Authority Reconciliation

Certificate ID: `TL-KNOWLEDGE-FACTORY-V2-AUTHORITY-001`

Status: **CERTIFIED**

Date: 2026-09-05

Scope: Documentation authority only

Production authorization: **NONE**

## 1. Executive verdict

The Milestone/Event/Timeline View/Timeline View Specification/Published Memory/Projection authority model is reconciled. Milestone remains the domain-level chronological authority. Event is its implementation, persistence, and public-DTO representation rather than a parallel authority. Factory-resolved records remain canonicalized candidates until Governance approval and Historical Library admission. Timeline View Specifications preserve editorial organization without becoming historical-fact authority. Projection materializes approved inputs and creates no historical or editorial authority.

There are zero unresolved active authority contradictions blocking the next work package.

**TL-KF-V2-000: CERTIFIED**

**V2-001 AUTHORIZED FOR IMPLEMENTATION PLANNING**

This certificate does not authorize V2-001 implementation, runtime changes, schema/index changes, deployment, production requests, review-item advancement, Published Memory mutation, autonomous discovery, or a merge to `main`.

## 2. Authority and documents reviewed

Repository authority, not implementation naming, controlled the reconciliation.

| Authority area | Documents reviewed | Finding |
|---|---|---|
| Product | `Knowledge/01_PRODUCT_CONSTITUTION_V2.md` | Milestones own chronology; Timeline Views provide narrative; clarified admission and membership boundary. |
| Architecture/schema/execution | `Knowledge/02_ARCHITECTURE_CANON_V2.md`, `Knowledge/03_SCHEMA_CANON_V2.md`, `Knowledge/05_EXECUTION_CANON_V2.md` | Institutional separation controls; added exact view-specification ownership and Event alias. |
| Current platform status | `Knowledge/07_PLATFORM_STATUS_AND_ROADMAP.md`, `docs/migrations/TL-TIMELINE-QUALITY-003.md` | Institutional path remains certified; current V3 live certification failed; autonomous discovery remains paused. |
| Authority registries | `Knowledge/AUTHORITY_INDEX.md`, `docs/authority/AUTHORITY_INDEX.md` | V2 hierarchy registered without elevating design/roadmap/certificate over constitutions. |
| Institutional/publication | `docs/architecture/INSTITUTIONAL_ARCHITECTURE.md`, `docs/architecture/PUBLICATION_CONSTITUTION.md` | Found and corrected active Milestone, Published Memory, Projection, package-flow, and view-lineage contradictions. |
| Domain | `docs/architecture/DOMAIN_MODEL.md`, `docs/architecture/WAVE_2A_LOCK.md` | Historical Object/Participation/Milestone/View doctrine controls; added implementation terminology and view specification. |
| Historical authority | `docs/constitution/HISTORICAL_OBJECT_CONSTITUTION.md`, `docs/constitution/HISTORICAL_LIBRARY_CONSTITUTION.md` | Historical Library alone admits canonical authority; clarified candidate identity and view preservation. |
| Governance | `docs/architecture/WAVE_2B_GOVERNANCE_IMPLEMENTATION_LOCK.md` | Governance verifies and approves/rejects; it does not create facts or perform Library admission. |
| Factory | `docs/factory/FACTORY_CONSTITUTION.md`, `FACTORY_ARCHITECTURE.md`, `FACTORY_ARTIFACT_MODEL.md`, `PUBLICATION_PIPELINE.md`, `RESEARCH_PIPELINE.md`, `VALIDATION_PIPELINE.md` | Factory owns Production Memory and candidates; package/view language reconciled. |
| V2 locks | `docs/factory/EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2.md`, `EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2_ROADMAP.md` | Applied the locked candidate/admission/view-specification boundary; no V2 runtime work performed. |

## 3. Controlling doctrine

The controlling interpretation is:

```text
Historical Objects provide context.
Participation provides historical meaning.
Milestones provide chronology.
Timeline Views provide curated narrative organization.
```

Authority state is lifecycle-specific:

- Factory may resolve and version candidate identities, claims, Milestones/Events, and view specifications.
- `canonicalized candidate` describes resolution quality inside Production Memory; it does not mean admitted authority.
- Governance evaluates the immutable candidate package and approves, rejects, or requests revision.
- Historical Library alone admits Governance-approved records as canonical historical authority.
- Published Memory preserves the admitted published authority and exact non-factual view-specification lineage.
- Projection mechanically materializes presentation from those approved inputs and creates no authority.

## 4. Contradictions and dispositions

| Finding | Prior conflicting language | Controlling authority | Disposition |
|---|---|---|---|
| Milestone status | Publication Constitution listed Milestones as non-canonical projections but Law 4 called them canonical chronology | Product Constitution, Domain Model, Institutional Architecture, Publication Law 4 | **ACTIVE CONTRADICTION — RESOLVED.** Milestones moved into the candidate canonical-authority envelope and become canonical only on Library admission. |
| Published Memory status | Publication Constitution called Published Memory a projection and not authority | Institutional Architecture, Schema Canon, Historical Library Constitution | **ACTIVE CONTRADICTION — RESOLVED.** Published Memory preserves immutable admitted published authority; it does not independently create it. |
| Projection responsibility | Projection was said to generate Milestones, membership, and views | Institutional rule that authority is never recreated downstream; V2 view-specification lock | **ACTIVE CONTRADICTION — RESOLVED.** Projection materializes admitted Milestones and exact approved membership/view specifications; it cannot select or invent them. |
| Package position | Documents alternated between a Factory-to-Library handoff and a Governance-to-Library package | Institutional chain and Governance enforcement | **ACTIVE CONTRADICTION — RESOLVED.** Factory prepares one immutable candidate package, Governance approves/rejects it, and Historical Library admits the approved package. |
| Candidate canonicality | Factory and domain language could read as if Factory resolution itself created canonical authority | Institutional Laws 3–5 and V2 lock | **ACTIVE AMBIGUITY — RESOLVED.** Factory records are explicitly canonicalized candidates until Library admission. |
| Timeline View preservation | Library listed published Timeline Views without separating facts from editorial organization | Product/Schema canons and V2 view-specification contract | **ACTIVE AMBIGUITY — RESOLVED.** Facts remain admitted authority; immutable view references/hashes preserve selection and ordering without becoming historical facts. |

## 5. Terminology and authority matrix

| Term | Domain meaning | Factory state | After admission | Public/implementation alias | Authority owner |
|---|---|---|---|---|---|
| Historical Object | Persistent historical entity providing context | Historical Object Candidate; may be identity-resolved/canonicalized | Canonical Historical Object | object/entity DTO | Historical Object authority; admitted/preserved by Historical Library |
| Milestone | Historically meaningful chronological occurrence or transition | Candidate Milestone | Canonical chronological authority | `Event` | Chronology authority; admitted/preserved by Historical Library |
| Event | Implementation/persistence/public representation of Milestone chronology | Event candidate/version | Represents the admitted Milestone version | event document/DTO | Same authority as Milestone; no separate owner |
| Canonical Event Candidate | Resolved reusable candidate representation of a Milestone | Factory Production Memory only | Becomes an admitted Event/Milestone version only through the institutional path | `canonicalEvents` / event version | Factory before admission; Historical Library after admission |
| Atomic Claim | Smallest independently supportable/contradictable assertion | Candidate claim version with evidence verdict | Admitted claim authority within the approved historical record | claim/version | Factory candidate; Historical Library preserves admitted version |
| Timeline View | Curated ordered narrative over admitted Milestones and Historical Objects | Proposed rendering/view | Approved published narrative organization | timeline DTO/page | Chronology platform for narrative; not historical-fact authority |
| Timeline View Specification | Immutable selection/order/phase/dimension/significance/rationale/context contract | Factory-owned Editorial Intelligence artifact | Preserved by exact reference/hash, not admitted as historical fact | view specification | Factory Editorial Intelligence |
| Timeline Event Membership | One ordered Milestone/Event edge in a view specification | Immutable Factory editorial edge | Preserved technical lineage used for reproduction | timeline-event edge | Factory Editorial Intelligence |
| Publication Package | Immutable candidate transfer artifact | Prepared by Factory; candidate authority envelope plus technical lineage | Governance-approved package is eligible for Library admission | governance package | Factory prepares; Governance decides; Library admits |
| Historical Library Admission | Institutional act that creates canonical status for approved records | Not available to Factory | Canonical authority boundary and immutable admission record | library admission | Historical Library |
| Published Memory | Immutable officially published representation of admitted authority | Outside Factory Production Memory | Preserves admitted records, decisions, evidence, versions, and view-spec references/hashes | published snapshot | Historical Library |
| Projection | Rebuildable deterministic transformation of approved inputs | No Factory authority | Denormalized presentation/read state only | timeline/search/sitemap/read models | Projection Engine; zero historical authority |
| Public Timeline | User-facing rendering of a published Timeline View | Not a Factory authority artifact | Read-only presentation of projection | page/API/search result | Public Platform; zero historical authority |

## 6. Factual authority versus view specification

Factual authority consists of admitted Historical Objects, Milestones/admitted Event versions, Atomic Claims, evidence/provenance, and constitutionally authoritative participation/relationships.

Editorial/technical view specification consists of which admitted Milestones appear, their ordering, phase/dimension placement, significance class and rationale, selection rationale, and timeline-specific narrative context references.

The view specification is immutable and hash-addressed so the published view is exactly reproducible. It remains outside the package's canonical historical-authority mapping. Governance verifies that references are valid, selection introduces no unsupported claim, and lineage is exact. Approval does not transform arbitrary view metadata into historical facts.

## 7. Reconciled authority flow

```text
Factory Production Memory
  Historical Object Candidates
  Atomic Claim Candidates + Evidence
  Canonical Event / Milestone Candidates
  Timeline View Specification + Membership
        |
        v
Historical Publication Package (immutable candidate envelope + technical lineage)
        |
        v
Governance (approve / reject / request revision; no fact creation)
        |
        v
Historical Library Admission (sole canonical admission boundary)
        |
        v
Canonical Historical Authority
        |
        v
Published Memory (admitted authority + exact view-spec references/hashes)
        |
        v
Projection Engine (deterministic materialization only)
        |
        v
Public Timeline / Search / APIs
```

No arrow gives Projection or a Timeline View independent power to create facts, identity, chronology, relationships, significance, membership, or canonical authority.

## 8. Governance, Published Memory, and Projection rules

Governance must verify that selected candidate authority is evidence-valid, specification references resolve, selection introduces no unsupported historical claim, and the package preserves exact lineage. It does not write missing facts and does not itself perform canonical admission.

Published Memory must preserve sufficient immutable IDs, versions, and hashes to reconstruct admitted Historical Objects, Milestones, Atomic Claims/evidence, the exact approved Timeline View, source/evidence lineage, Governance/Library lineage, and relevant policy/model lineage. Technical view references remain explicitly non-factual.

Projection may transform, denormalize, apply approved ordering, and build public DTOs, search, sitemap, relationship, and other read models. It may not select Milestones, change identity or dates, invent membership or relationships, reinterpret significance, or create canonical authority.

## 9. V2 implementation consequences

V2-001 and later planning may assume:

- `canonicalEvents` is a valid implementation collection name;
- before admission, its records are Factory candidate knowledge regardless of `canonical` in the identifier;
- admitted Event versions correspond exactly to Milestone chronological authority;
- Timeline View Specifications and membership edges remain non-factual Factory Editorial Intelligence artifacts;
- timeline membership may be persisted technically without becoming independent historical truth;
- Governance validates view-specification references and absence of unsupported claims without mapping view metadata as fact authority;
- Published Memory preserves exact admitted IDs plus technical references/hashes required for replay;
- Projection consumes the specification only after exact admitted references validate;
- no Event-to-Milestone runtime or schema rename is required for terminology alignment.

## 10. Exact amendments

| Document | Amendment |
|---|---|
| `Knowledge/01_PRODUCT_CONSTITUTION_V2.md` | Locked the admission boundary, Event alias, and non-factual membership principle. |
| `Knowledge/02_ARCHITECTURE_CANON_V2.md` | Added immutable view-specification lineage and Projection prohibitions. |
| `Knowledge/03_SCHEMA_CANON_V2.md` | Assigned owners to Timeline View Specifications/Membership and reconciled admitted Event/Milestone ownership. |
| `Knowledge/AUTHORITY_INDEX.md` | Registered institutional, V2, and certificate authority at subordinate levels. |
| `docs/authority/AUTHORITY_INDEX.md` | Registered the Factory V2 hierarchy and certificate without changing precedence. |
| `docs/architecture/PUBLICATION_CONSTITUTION.md` | Removed the Milestone and Published Memory contradictions; reconciled package lifecycle, admission, view lineage, and Projection limits. |
| `docs/architecture/INSTITUTIONAL_ARCHITECTURE.md` | Clarified candidate evaluation/admission and prohibited Projection from inventing editorial choices. |
| `docs/architecture/DOMAIN_MODEL.md` | Defined Event equivalence, candidate status, Timeline View Specification, complete authority flow, and Projection limits. |
| `docs/constitution/HISTORICAL_OBJECT_CONSTITUTION.md` | Distinguished Factory identity resolution from canonical admission. |
| `docs/constitution/HISTORICAL_LIBRARY_CONSTITUTION.md` | Locked sole admission, Governance-approved intake, and non-factual view preservation. |
| `docs/factory/FACTORY_CONSTITUTION.md` | Clarified candidate status, Event alias, view ownership, and Governance-aware package doctrine. |
| `docs/factory/FACTORY_ARCHITECTURE.md` | Added the complete institutional flow and technical view-specification boundary. |
| `docs/factory/PUBLICATION_PIPELINE.md` | Reconciled the package path and canonical envelope versus technical lineage. |

## 11. Repository terminology audit

| Classification | Findings |
|---|---|
| `ACTIVE CONTRADICTION` | **0 unresolved.** The six active findings in §4 were corrected. |
| `SUPERSEDED/HISTORICAL` | The locked V2 design and roadmap retain their pre-reconciliation problem statements as decision history. Audit/migration records describe state at their recorded time and are not normative current authority. |
| `IMPLEMENTATION TERMINOLOGY` | `Event`/`events` in persistence, public DTO, older authority context, and graph registry text is the implementation representation of Milestone chronology. Collection names such as `published_memory_projections` are storage terminology, not authority claims. |
| `NO CONFLICT` | Statements that Milestones are canonical chronology, Timeline Views are projections/not historical authority, Published Memory preserves authority, and Projection creates no authority are consistent with the reconciled doctrine. |

## 12. Non-blocking documentation debt

- `docs/authority/AUTHORITY_INDEX.md` still describes PostgreSQL/Neon as verified current implementation while the active certified runtime is Firestore. This is implementation-status debt, not an authority-semantics conflict.
- Knowledge and Factory current-reality sections retain early local Qwen/Ollama certification evidence. Those statements are historical implementation evidence and should later be relabeled or modernized without changing authority.
- Some lower-tier Factory/domain open questions ask which Historical Library constitution is canonical even though the repository now contains a locked constitution. These are stale open-question labels, not competing doctrine.
- Historical audit, migration, graph, and data documents use `Event` directly. They remain valid implementation terminology under the matrix above and do not require a runtime or bulk documentation rename.

These items do not block V2-001 planning and must not be silently treated as current runtime truth.

## 13. Validation record

Validation performed after amendment:

- repository-wide terminology search covering Milestone projection/canonicality, Event canonicality, Timeline/Timeline View canonicality, Published Memory authority, and Projection authority;
- classification of every match into active contradiction, superseded/historical, implementation terminology, or no conflict;
- relative Markdown reference resolution for every changed document;
- Markdown heading/code-fence integrity and trailing-whitespace checks;
- `git diff --check`;
- changed-path boundary proving documentation-only edits;
- source-control baseline and remote equality before editing.

Results:

- 14 changed Markdown authority/record documents passed reference resolution, code-fence balance, and trailing-whitespace checks;
- the explicit prohibited-formulation scan returned zero matches;
- `git diff --check` passed;
- changed paths are confined to `Knowledge/**` and `docs/**`;
- no runtime, Firestore rule/index, Cloud Task/Scheduler, Vertex, Vercel, or production configuration path changed;
- no production API, database, deployment, replay, or review transition was invoked.

No runtime test suite is required because no runtime, schema, configuration, rule, or index changed. Final source-control equality is recorded in the certifying commit completion report.

## 14. Readiness verdict

All authority prerequisites defined for Phase 0 are reconciled. Ownership does not move downstream; candidate status cannot be mistaken for admission; view membership is reproducible without becoming factual authority; and Event naming is safe for implementation without migration.

**TL-KF-V2-000: CERTIFIED**

**V2-001 AUTHORIZED FOR IMPLEMENTATION PLANNING**

V2-001 is not implemented or otherwise executed by this certificate.
