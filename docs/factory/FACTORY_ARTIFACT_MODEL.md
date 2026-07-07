# Factory Artifact Model

Authority Level: Factory Architecture
Governed System: Factory objects, artifacts, and permanent Production Memory identities.
Describes: Future Architecture

## Scope
This document defines the Factory artifact doctrine beneath the Factory Constitution.

## Non-Scope
This document does not define storage technology, database schema, object serialization, or implementation mechanics.

## Product Identity
Factory artifacts exist to support a Chronological Knowledge Platform. They must preserve historical context, chronology, narrative derivation, evidence, and publication memory.

## Factory Object Identity Doctrine
Factory objects have permanent UUID identities. A Factory object identity must remain stable across research, validation, Publication Package creation, Historical Library admission, Feedback Package return, and amendment cycles.

## Historical Object Doctrine
Historical Object artifacts represent canonical historical entities that persist through time and participate in Milestones.

## Milestone Doctrine
Milestone artifacts represent canonical chronological knowledge units. They are central relationship nodes and cannot be reduced to timeline rows.

## Timeline View Doctrine
Timeline View artifacts represent curated narrative views derived from Milestones and Historical Objects.

## Publication Package Doctrine
Publication Packages are Factory artifacts prepared for Historical Library admission. They are more authoritative than implementation-specific import batches.

## Feedback Package Doctrine
Feedback Packages are Factory artifacts produced from Published Memory amendments, corrections, disputes, or quality signals.

## Tiered Source Authority
Evidence artifacts must preserve source tier, source material, publisher authority, and provenance context.

## Current Reality
Factory runtime now persists durable Factory objects and artifacts for certified candidate generation and Editorial Intelligence runs.

Certified on 2026-06-22:
- Research pipeline run `1072ee3e-d8d9-459c-a35c-80f515bd2be8`.
- Extraction pipeline run `4a32aedc-b7a7-4605-aed9-08890fd42ade`.
- Persisted Factory candidate object classes: source, context record, historical object, milestone, participation, and relationship.
- Persisted Factory artifacts for worker outputs and certified Editorial Intelligence checkpoints.

The repository also contains CSV files under `data/` and import/recovery services that consume CSV content. Normal imports are not durable Factory artifacts.

## Future Architecture
Factory artifacts include Historical Objects, Milestones, Timeline Views, relationships, sources, publisher authority evidence, validation records, Publication Packages, Feedback Packages, and audit records.

## Dependencies
- `docs/factory/FACTORY_CONSTITUTION.md`
- `docs/factory/FACTORY_ARCHITECTURE.md`
- `docs/factory/FACTORY_AUDIT_MODEL.md`
- `docs/factory/PUBLICATION_PIPELINE.md`

## Open Questions
- Which artifact classes must be visible in Published Memory after Historical Library admission?
- Which Feedback Package artifacts are permanent Factory memory?

## Future Evolution
Artifact documentation must retain UUID identity doctrine and must not make import batches the primary Factory object.
