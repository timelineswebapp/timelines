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
Relationship recovery reports persist totals and row samples. Structured logs exist for import failures. These are useful audit precedents but are not complete Factory audit records.

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
