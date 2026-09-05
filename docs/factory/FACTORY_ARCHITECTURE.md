# Factory Architecture

Authority Level: Factory Architecture
Governed System: Chronological Knowledge Factory architecture.
Describes: Both

## Scope
This document defines the Tier 2 architectural shape of the Chronological Knowledge Factory.

## Non-Scope
This document does not define implementation infrastructure, database schema, migration strategy, or execution plan.

## Product Identity
The Factory supports TiMELiNES as a Chronological Knowledge Platform. Its architectural subject is chronological knowledge, not timeline generation.

## Constitutional Architecture
The approved architecture is:

```text
Factory
  -> Publication Package
    -> Governance
      -> Historical Library
        -> Published Memory
          -> Projection
            -> Platform
```

The amendment path is:

```text
Historical Library
  -> Feedback Package
    -> Factory
```

## Factory Boundary
The Factory owns Production Memory. Production Memory includes Factory objects, research evidence, validation records, source tier assessments, Publication Packages, Feedback Packages, and Factory audit records.

## Historical Library Boundary
The Historical Library owns Published Memory. It is the permanent published collection of TiMELiNES and is conceptually separate from Factory Production Memory.

## Knowledge Model
Factory architecture must preserve:

```text
Historical Objects -> Milestones -> Timeline Views
```

- Historical Objects provide context.
- Milestones provide chronology and serve as central relationship nodes.
- Timeline Views provide curated narrative.

Factory-resolved Historical Objects and Milestones are canonicalized candidates until Governance approval and Historical Library admission. `Canonical Event` is permitted implementation terminology for the Milestone representation, not a parallel domain authority.

Timeline View Specifications and Timeline Event Membership are immutable Factory-owned technical/editorial artifacts. Approved package lineage preserves their exact references and hashes for deterministic Projection, but neither the specification nor Projection owns historical facts, membership invention, significance interpretation, or canonical admission.

## Relationship Doctrine
Relationships exist to explain history. Relationship architecture must center Milestones and must not treat Timeline Views as the canonical relationship container.

## Current Reality
Factory runtime execution is certified as part of the completed institutional architecture. The implemented Factory runtime can execute canonical pipelines through the provider abstraction, call local Qwen via Ollama, validate structured worker output, and persist Factory Production Memory objects and artifacts.

Early certified runtime evidence:
- Research pipeline run `1072ee3e-d8d9-459c-a35c-80f515bd2be8` completed for `Telephone`.
- Extraction pipeline run `4a32aedc-b7a7-4605-aed9-08890fd42ade` completed for `Telephone`.
- Factory objects and artifacts were verified for candidate source, context record, historical object, milestone, participation, and relationship generation.

Current code also supports import parsing, validation, duplicate detection, relationship insertion, chronology parsing, and recovery reports. Those capabilities are useful precedents. Factory runtime, Editorial Intelligence, Governance handoff, Historical Library admission, Published Memory, Projection Engine, Search, and Public Platform are now certified through the institutional certification program.

## Future Architecture
Factory architecture is valid only when it preserves Factory/Library memory separation, Publication Package handoff, Feedback Package return, Tiered Source Authority, and permanent Factory object identities.

The locked evidence-first sequencing, Scope Contract, Research Map, atomic-claim, canonical-event-candidate, event-lock, and constrained-writer contracts are specified in `EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2.md`. They are subordinate to the institutional and Factory constitutions and are not implemented by this documentation change.

The implementation order, additive Firestore transition, shadow boundary, certification gates, and cutover conditions are specified in `EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2_ROADMAP.md`. That roadmap may not alter this architecture.

## Dependencies
- `docs/factory/FACTORY_CONSTITUTION.md`
- `docs/factory/EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2.md`
- `docs/factory/EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2_ROADMAP.md`
- `docs/factory/FACTORY_ARTIFACT_MODEL.md`
- `docs/factory/PUBLICATION_PIPELINE.md`
- `docs/factory/RESEARCH_PIPELINE.md`
- `docs/factory/VALIDATION_PIPELINE.md`

## Open Questions
- Which Historical Library document will own Published Memory admission outside Factory?
- Which Factory object classes require direct Feedback Package references?

## Future Evolution
Architectural refinements must preserve the constitutional flow and vocabulary. Import-centered or projection-centered language is subordinate to Publication Package doctrine.
