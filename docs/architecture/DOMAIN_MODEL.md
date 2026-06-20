# Domain Model

Authority Level: Tier-2 Architecture Authority
Governed System: TiMELiNES canonical domain model, authority boundaries, relationship model, memory model, publication model, and separation of concerns.
Status: LOCKED ARCHITECTURAL AUTHORITY
Describes: Future Architecture

## Scope
This document defines the official TiMELiNES domain model beneath the constitutional authorities. It governs the meaning and architectural boundaries of Historical Objects, Participation, Milestones, Timeline Views, Sources, Publishers, Production Memory, Published Memory, Publication Packages, Feedback Packages, and Platform responsibilities.

## Non-Scope
This document does not define database schemas, APIs, migrations, storage models, search indexes, UI components, infrastructure, or implementation details.

## Product Identity
Name: TiMELiNES.

Definition: TiMELiNES is a Chronological Knowledge Platform.

Principle: Chronology remains the organizing principle of the system.

## Core Knowledge Model
The canonical knowledge model is:

```text
Historical Object -> Participation -> Milestone -> Timeline View
```

Core meaning:
- Historical Objects provide context.
- Participation provides historical meaning.
- Milestones provide chronology.
- Timeline Views provide narrative.

## Primary Historical Authorities
TiMELiNES has four primary historical authorities:
- Historical Object
- Milestone
- Source
- Publisher

## Domain Relationship Authorities
TiMELiNES has three primary domain relationship authorities:
- Participation
- Citation
- Publication

## Historical Object Doctrine
A Historical Object is a canonical historical entity that persists through time and participates in Milestones.

Tier-1 Historical Object types:
- Person
- Institution
- Place
- Technology
- Publication
- Conflict
- Movement
- Period

Historical Object authority:
- Independent authority.
- Not derived from Timeline Views.
- Not derived from Search.
- Not derived from Milestones.
- May participate in many Milestones.
- May appear in many Timeline Views.

## Participation Doctrine
Participation connects Historical Objects to Milestones and provides historical meaning.

Participation answers how a Historical Object matters to a Milestone. It is not a display-only association and it is not owned by Timeline Views.

## Milestone Doctrine
A Milestone is the canonical chronological knowledge unit.

Milestone authority:
- Owns chronology.
- May reference many Historical Objects.
- May contain many Citations.
- May appear in many Timeline Views.

Milestones are central relationship nodes. Relationships exist to explain history.

## Timeline View Doctrine
A Timeline View is a curated narrative view built from Milestones and Historical Objects.

Timeline View authority:
- Narrative projection.
- Consumes authority.
- Does not create authority.
- Consumes Historical Objects.
- Consumes Participations.
- Consumes Milestones.

## Source Doctrine
Sources provide evidence. Sources support historical knowledge but do not create historical authority by themselves.

## Publisher Doctrine
Publishers provide evidence authority. A Publisher is responsible for publishing evidence and is distinct from the Source itself.

## Citation Doctrine
Citation connects Sources to Milestones and explains evidence support.

```text
Source -> Citation -> Milestone
```

Citation is the domain authority for evidence linkage.

## Publication Doctrine
Publication connects Publishers to Sources and explains evidence authority.

```text
Publisher -> Publication -> Source
```

Publication is the domain authority for publisher/source linkage.

## Separation Of Concerns
- Context: Historical Objects.
- Chronology: Milestones.
- Historical meaning: Participation.
- Evidence: Sources.
- Evidence authority: Publishers.
- Narrative: Timeline Views.

## Memory Model
Production Memory:
- Owner: Factory.
- Contains research artifacts.
- Contains validation artifacts.
- Contains candidate objects.
- Contains candidate milestones.
- Contains generation outputs.
- Contains production history.

Published Memory:
- Owner: Historical Library.
- Contains published historical objects.
- Contains published milestones.
- Contains published timeline views.
- Contains published relationships.
- Contains published sources.
- Contains published publishers.

## Publication Model
The publication model is:

```text
Factory -> Publication Package -> Historical Library -> Platform
```

Factory produces. Historical Library preserves. Platform presents.

## Feedback Model
The feedback model is:

```text
Historical Library -> Feedback Package -> Factory
```

Feedback Packages return amendments, corrections, disputes, and quality signals from Published Memory to Production Memory.

## Platform Responsibilities
The Platform owns:
- Discovery.
- Search.
- Navigation.
- Rendering.
- SEO.
- User experience.

The Platform presents knowledge. It does not create domain authority.

## Required Domain Diagrams
Evidence authority chain:

```text
Publisher -> Publication -> Source -> Citation -> Milestone <- Participation <- Historical Object
```

Knowledge model:

```text
Historical Object -> Participation -> Milestone -> Timeline View
```

Memory and publication model:

```text
Factory -> Publication Package -> Historical Library -> Platform
```

## Architectural Principles
- Milestones remain the canonical knowledge unit.
- Historical Objects and Milestones are independent authorities.
- Participation is a first-class authority.
- Timeline Views are projections, not authorities.
- Historical Objects provide context.
- Milestones provide chronology.
- Timeline Views provide narrative.
- Factory produces.
- Historical Library preserves.
- Platform presents.

## Authority Boundaries
This document is the Tier-2 architecture authority for the domain model. It does not supersede constitutional authorities. It translates constitutional doctrine into architectural domain boundaries.

This document must remain consistent with:
- Product Constitution.
- Historical Object Constitution.
- Historical Library Constitution.
- Factory Constitution.

If this document conflicts with a constitutional authority, the constitutional authority wins.

## Dependencies
- `docs/authority/01_PRODUCT_CONSTITUTION.md`
- `docs/factory/FACTORY_CONSTITUTION.md`
- `docs/graph/ONTOLOGY_AUTHORITY.md`
- `docs/data/MILESTONE_MODEL.md`
- `docs/data/SOURCE_MODEL.md`
- `docs/factory/PUBLICATION_PIPELINE.md`

## Open Questions
- Which document is the canonical Historical Library Constitution?
- Which document is the canonical Historical Object Constitution?
- Which source tiers are authoritative for Library admission?

## Future Evolution
This document is locked as architectural authority. Future changes must preserve the domain order Historical Object -> Participation -> Milestone -> Timeline View and must preserve the memory separation Factory -> Publication Package -> Historical Library -> Platform.
