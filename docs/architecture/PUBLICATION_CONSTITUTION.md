PUBLICATION_CONSTITUTION.md

TiMELiNES Historical Publication Constitution

Status: LOCKED (Tier-1 Constitutional Authority)

⸻

Purpose

This document defines the constitutional boundary between the Governance Institution and the Historical Library.

It specifies the only form of historical knowledge that may leave Governance and become eligible for permanent institutional admission.

This document is constitutional authority.

Implementations, services, repositories, databases, projections, APIs, and user interfaces shall conform to this document.

⸻

Constitutional Principle

Governance approves candidate historical knowledge as eligible for admission; it does not make Factory records canonical merely by review.

The Historical Library alone admits canonical historical knowledge.

Everything else is derived.

⸻

Institutional Sequence

Factory
    ↓
Historical Publication Package (candidate)
    ↓
Governance
    ↓
Governance-approved Historical Publication Package
    ↓
Historical Library
    ↓
Published Memory
    ↓
Projection
    ↓
Timeline Views
    ↓
Platform

This sequence is immutable.

⸻

Historical Publication Package

The Historical Publication Package is prepared by Factory, submitted immutably to Governance, and—only after approval—presented to the Historical Library for admission.

It is the only authoritative publication contract.

No other object may be admitted into the Historical Library.

⸻

Canonical Contents

A Historical Publication Package contains a canonical-authority envelope of candidate records eligible for Governance approval and Historical Library admission. Before admission, those records remain Factory candidate knowledge rather than canonical published authority.

Historical Objects

Candidate historical entities approved by Governance for admission.

Each Historical Object shall preserve:

* UUID
* Authority identity
* Canonical lineage
* Governance approval
* Version
* Audit history

⸻

Milestones

Candidate chronological knowledge units approved by Governance for admission.

Each Milestone shall preserve its identity, chronology, Atomic Claims and evidence, participation and relationship lineage, version, and audit history. In implementation and persistence contracts, `Event` is the representation of this same Milestone chronology; it is not a second domain authority.

⸻

Participations

Candidate participations approved for admission with their Historical Objects and Milestones.

⸻

Relationships

Candidate relationships approved for admission.

⸻

Context Records

Candidate contextual records approved for admission with their Historical Objects.

⸻

Source Authority

Source references and authority lineage approved for admission.

Publication Packages shall never contain temporary retrieval artifacts.

⸻

Validated Evidence

Only evidence that has successfully passed the Evidence Validation Institution may enter the Historical Publication Package.

Evidence shall preserve:

* Evidence Record
* Validation Record
* Source Authority
* Citation lineage
* Provenance

⸻

Governance Metadata

The package shall preserve:

* Governance Decision
* Approval
* Readiness Certification
* Package Version
* Audit Records

⸻

Non-Factual and Derived Structures

The following structures are not independent historical-fact authority. Governance verifies their integrity and use, but approval does not convert their editorial or technical metadata into historical facts. A package may preserve immutable references and hashes for exact reproduction without placing them inside its canonical-authority envelope.

⸻

Timeline Membership

Timeline membership is Factory-owned editorial selection recorded in an immutable Timeline View Specification. It is not independent historical-fact authority.

⸻

Timeline Views

Timeline Views are curated narrative organizations over admitted Milestones and Historical Objects. Their factual content derives from admitted authority; their selection and ordering remain editorial specification.

⸻

Timeline View Specifications

Timeline View Specifications and their membership records are immutable Factory-owned technical/editorial artifacts. Governance verifies valid references, supported selection, and exact lineage. Historical Library and Published Memory preserve their references and hashes for reproducibility; they do not admit view metadata as historical fact.

⸻

Published Memory

Published Memory is the immutable published representation of authority admitted by the Historical Library. It preserves authority but does not independently create or reinterpret it.

⸻

Read Models

Read Models are runtime optimizations.

They are not authority.

⸻

Search Indexes

Indexes are implementation artifacts.

They are not authority.

⸻

SEO Structures

SEO is presentation.

It is not authority.

⸻

Historical Library Responsibilities

The Historical Library shall:

* admit Historical Publication Packages;
* preserve canonical historical knowledge;
* preserve authority lineage;
* preserve evidence lineage;
* preserve governance lineage;
* preserve publication versions;
* preserve audit history.

The Historical Library shall never invent history.

⸻

Published Memory Responsibilities

Published Memory shall contain only admitted historical knowledge.

Published Memory shall never contain editorial state.

Published Memory shall never contain candidate knowledge.

Published Memory shall remain deterministic.

Published Memory shall also preserve immutable references and hashes sufficient to reproduce the exact approved Timeline View without treating the referenced technical view specification as historical-fact authority.

⸻

Projection Responsibilities

Projection transforms admitted historical knowledge into public platform structures.

Projection may materialize:

* admitted Milestones as public Event DTOs
* approved Timeline Membership from the preserved Timeline View Specification
* approved Timeline Views
* Platform Read Models
* Search Documents
* SEO Structures

Projection shall never modify authority.

Projection shall never create historical knowledge.

Projection shall never select Milestones, change Milestone identity or chronology, invent membership, or reinterpret significance. It may order only according to the exact preserved and verified Timeline View Specification.

Projection shall remain deterministic and reproducible.

⸻

Platform Responsibilities

The Platform consumes Published Memory.

The Platform shall never create authority.

The Platform shall never modify canonical historical knowledge.

The Platform shall never bypass Governance or the Historical Library.

⸻

Canonical Equivalence

Milestone is the constitutional domain concept.

Event is the current persistence implementation.

Throughout TiMELiNES, Milestone and Event refer to the same canonical chronological authority.

Milestone is the domain language.

Event is the implementation language.

Future implementations may rename persistence from Event to Milestone without changing constitutional semantics.

⸻

Constitutional Laws

Law 1

Governance approves candidate historical knowledge as eligible for canonical admission.

⸻

Law 2

The Historical Publication Package is the only constitutional publication artifact.

⸻

Law 3

Only canonical historical authority may enter the Historical Library.

⸻

Law 4

Milestones are canonical chronological authority.

In the current implementation, Milestones are persisted as Events.

Governance approves candidate Milestones together with their chronology, claims, evidence, participations, version, and audit lineage as eligible for admission.

Historical Library alone admits approved Milestones as canonical chronological authority.

Projection materializes Timeline Membership and Timeline Views from admitted Milestones according to the exact preserved and approved Timeline View Specification; it does not select membership.

⸻

Law 5

Timeline Membership is editorial organization preserved in a Timeline View Specification.

It is never independent historical-fact authority.

⸻

Law 6

Timeline Views are derived.

They are never canonical authority.

⸻

Law 7

Published Memory preserves admitted canonical authority only.

⸻

Law 8

Projection creates views, never authority.

⸻

Law 9

Authority lineage shall remain continuous across:

Factory → Governance → Historical Library → Published Memory.

⸻

Law 10

Every public timeline shall be reproducible from admitted canonical historical knowledge plus the exact approved, preserved Timeline View Specification. The specification supplies organization only and cannot supply historical facts.

⸻

Constitutional Consequences

Every implementation shall preserve the following institutional separation:

Factory Candidate Authority
        ↓
Historical Publication Package
        ↓
Governance
        ↓
Historical Library
        ↓
Canonical Authority
        ↓
Published Memory
        ↓
Projection
        ↓
Platform

Presentation shall never become authority.

Authority shall never depend on presentation.

⸻

Constitutional Status

This document is Tier-1 constitutional authority.

Future implementations of:

* Governance
* Historical Library
* Published Memory
* Projection
* Platform Runtime

shall conform to this constitution.

Architectural deviations require an explicit constitutional amendment.
