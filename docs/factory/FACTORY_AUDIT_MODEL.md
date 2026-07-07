# Factory Audit Model

Authority Level: Factory Operational
Governed System: Factory Production Memory auditability.
Describes: Both

## Scope
This document defines audit doctrine for Factory Production Memory, Publication Packages, and Feedback Packages.

## Non-Scope
This document does not implement audit storage or define log infrastructure.

## Product Identity
Factory audit exists to protect TiMELiNES as a Chronological Knowledge Platform by preserving why Historical Objects, Milestones, Timeline Views, sources, and relationships were produced or amended.

## Factory Doctrine
Factory owns Production Memory. Audit records are part of Production Memory.

## Historical Library Doctrine
Historical Library owns Published Memory. Library admission and published amendments must be traceable back to Factory audit records or Feedback Packages.

## Publication Package Doctrine
Every Publication Package must have audit evidence showing its Factory origin, source tier basis, validation status, and approval context.

## Feedback Package Doctrine
Every Feedback Package must preserve the Published Memory signal that caused return to Factory: amendment, correction, dispute, quality issue, or editorial note.

## Tiered Source Authority
Audit records must preserve source tier decisions and publisher authority assumptions.

## Current Reality
Factory runtime now persists pipeline runs, pipeline steps, Factory objects, Factory artifacts, Editorial Intelligence artifacts, and runtime audit records for certified candidate generation and publication preparation runs.

Certified on 2026-06-22:
- Research pipeline run `1072ee3e-d8d9-459c-a35c-80f515bd2be8`.
- Extraction pipeline run `4a32aedc-b7a7-4605-aed9-08890fd42ade`.
- Verified persistence in `factory_pipeline_runs`, `factory_pipeline_steps`, `factory_objects`, and `factory_artifacts`.

Relationship recovery reports, import failure logs, and row samples remain useful audit precedents but are no longer the only implemented audit mechanisms relevant to Factory.

## Future Architecture
Factory audit doctrine requires durable traceability across Factory object creation, Publication Package handoff, Historical Library admission, Platform exposure, and Feedback Package return.

## Dependencies
- `docs/factory/FACTORY_CONSTITUTION.md`
- `docs/factory/FACTORY_ARTIFACT_MODEL.md`
- `docs/factory/PUBLICATION_PIPELINE.md`
- `docs/factory/FACTORY_ERROR_TAXONOMY.md`

## Open Questions
- Which audit records are visible to Historical Library operators?
- Which Feedback Package audit fields are required for amendment review?

## Future Evolution
Audit documentation must preserve Production Memory ownership and must not treat transient logs as the Factory record of authority.
