# Factory Constitution

Authority Level: Factory Constitutional
Governed System: Chronological Knowledge Factory doctrine and Factory authority hierarchy.
Describes: Both

## Scope
This document is the Tier 1 constitutional authority for TiMELiNES Factory doctrine. It governs the meaning of Factory, Historical Library, Production Memory, Published Memory, Publication Package, Feedback Package, Historical Object, Milestone, Timeline View, and Tiered Source Authority inside Factory documentation.

## Non-Scope
This document does not implement Factory code, define database schema, select infrastructure, or describe a technical execution plan.

## Product Identity
TiMELiNES is a Chronological Knowledge Platform. The Factory exists to produce chronological knowledge, not merely to generate timelines or import rows.

## Documentation Authority Hierarchy
- Tier 1 Constitutional Authority: `FACTORY_CONSTITUTION.md`.
- Tier 2 Architecture Authority: `FACTORY_ARCHITECTURE.md`, `FACTORY_ARTIFACT_MODEL.md`, `PUBLICATION_PIPELINE.md`, `RESEARCH_PIPELINE.md`, `VALIDATION_PIPELINE.md`.
- Tier 3 Operational Authority: `FACTORY_LIFECYCLE.md`, `FACTORY_AUDIT_MODEL.md`, `FACTORY_ERROR_TAXONOMY.md`, `TOPIC_GENERATION.md`.
- Implementation Guidance: `IMPORT_BATCH_MODEL.md`.

When Factory documents conflict, this constitution wins. Import batches, validation reports, and audit records are subordinate to Factory objects and Publication Packages.

## Historical Object Doctrine
A Historical Object is a canonical historical entity that persists through time and participates in milestones.

Tier-1 Historical Object types are:
- Person
- Institution
- Place
- Technology
- Publication
- Conflict
- Movement
- Period

Historical Objects provide context. They are not Timeline Views and they are not Milestones.

## Milestone Doctrine
A Milestone is the canonical chronological knowledge unit. Milestones carry chronology. Factory output must preserve Milestone identity and must not treat a Timeline View as the source of milestone truth.

## Timeline View Doctrine
A Timeline View is a curated narrative view built from Milestones and Historical Objects. Timeline Views provide narrative organization. They are not canonical knowledge containers.

## Historical Library Doctrine
The Historical Library is the permanent published collection of TiMELiNES. It owns Published Memory. Neon/PostgreSQL may serve as the published library target, but Published Memory is conceptually distinct from Factory Production Memory.

## Factory Doctrine
The Factory is the Chronological Knowledge Factory. It owns Production Memory. Production Memory includes Factory objects, evidence, research artifacts, validation records, Publication Packages, Feedback Packages, and audit history before or after publication.

## Publication Package Doctrine
A Publication Package is the authorized handoff from Factory to Historical Library. It contains the Factory-approved representation of Historical Objects, Milestones, Timeline Views, relationships, sources, and validation evidence that may enter Published Memory.

## Feedback Package Doctrine
A Feedback Package is the authorized return path from Historical Library to Factory. Editorial amendments, corrections, disputes, or quality signals from Published Memory must be preserved as Feedback Packages so Factory Production Memory learns from published amendments.

## Tiered Source Authority
Factory evidence is governed by Tiered Source Authority. Sources provide evidence; publishers provide evidence authority. Research and validation language must distinguish source material from publisher authority and must not treat all sources as equal.

## Core Separation of Concerns
- Historical Objects: context.
- Milestones: chronology.
- Timeline Views: narrative.
- Sources: evidence.
- Publishers: evidence authority.
- Factory: Production Memory.
- Historical Library: Published Memory.
- Platform: public presentation and discovery.

## Current Reality
Factory runtime is certified as part of the completed institutional architecture. Local Qwen execution through Ollama using `qwen3:14b` remains the certified local provider path for Factory execution.

Certified Factory Production Memory outputs include candidate sources, candidate context records, candidate historical objects, candidate milestones, candidate participations, candidate relationships, Editorial Evidence Sets, Editorial Timeline Candidates, Editorial Compositions, and Editorial Narratives persisted as Factory-owned technical memory where applicable.

Publication Candidate Pipeline completion, Governance handoff, Historical Library admission, Published Memory generation, Projection Engine, Search, and Public Platform are now certified through the institutional certification program. Factory still does not approve publication, admit Historical Library records, own Published Memory, or own Platform read models.

Existing import, validation, chronology, relationship recovery, and audit concepts remain useful precedents but are not the Factory constitutional model.

## Future Architecture
All Factory documents must align to this doctrine: Historical Objects -> Milestones -> Timeline Views, with Milestones as central relationship nodes and the publication flow Factory -> Publication Package -> Historical Library -> Platform.

## Dependencies
- `docs/authority/AUTHORITY_INDEX.md`
- `docs/factory/FACTORY_ARCHITECTURE.md`
- `docs/factory/PUBLICATION_PIPELINE.md`
- `docs/factory/FACTORY_ARTIFACT_MODEL.md`
- `docs/governance/PROVENANCE_POLICY.md`
- `docs/governance/SOURCE_CREDIBILITY_POLICY.md`

## Open Questions
- Which document outside Factory will become the top-level Historical Library constitutional authority?
- Which published amendment classes require Feedback Packages?

## Future Evolution
Factory documentation may become more detailed, but it must not demote Milestones, replace Publication Packages with imports, or collapse Production Memory into Published Memory.
