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
    -> Historical Library
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

## Relationship Doctrine
Relationships exist to explain history. Relationship architecture must center Milestones and must not treat Timeline Views as the canonical relationship container.

## Current Reality
Current code supports import parsing, validation, duplicate detection, relationship insertion, chronology parsing, and recovery reports. Those capabilities are useful precedents, but they are not a complete Factory architecture.

## Future Architecture
Factory architecture is valid only when it preserves Factory/Library memory separation, Publication Package handoff, Feedback Package return, Tiered Source Authority, and permanent Factory object identities.

## Dependencies
- `docs/factory/FACTORY_CONSTITUTION.md`
- `docs/factory/FACTORY_ARTIFACT_MODEL.md`
- `docs/factory/PUBLICATION_PIPELINE.md`
- `docs/factory/RESEARCH_PIPELINE.md`
- `docs/factory/VALIDATION_PIPELINE.md`

## Open Questions
- Which Historical Library document will own Published Memory admission outside Factory?
- Which Factory object classes require direct Feedback Package references?

## Future Evolution
Architectural refinements must preserve the constitutional flow and vocabulary. Import-centered or projection-centered language is subordinate to Publication Package doctrine.
