# Factory Lifecycle

Authority Level: Factory Operational
Governed System: Factory Production Memory lifecycle.
Describes: Future Architecture

## Scope
This document defines Factory lifecycle ownership and separates Factory lifecycle from Historical Library publication lifecycle.

## Non-Scope
This document does not define database status fields or execution workflow.

## Product Identity
The lifecycle governs a Chronological Knowledge Factory. It does not define timeline publication as the Factory's terminal purpose.

## Factory Lifecycle Doctrine
Factory lifecycle belongs to Production Memory. Factory states describe production readiness, evidence quality, validation posture, package readiness, and feedback processing.

## Historical Library Lifecycle Boundary
Published Memory belongs to the Historical Library, not the Factory. A Factory object is not “published” by becoming internally complete. It is admitted to Published Memory through a Publication Package.

## Publication Package Doctrine
Publication Package lifecycle is the handoff lifecycle between Factory and Historical Library. It must be conceptually separate from Factory object lifecycle.

## Feedback Package Doctrine
Feedback Package lifecycle is the return lifecycle from Historical Library to Factory after editorial amendment, correction, dispute, or quality review.

## Terminology Rule
The term `published` must not be used as a Factory-owned terminal state unless explicitly qualified as Historical Library admission or Published Memory status.

## Current Reality
Factory runtime now persists candidate Factory objects and worker artifacts through certified research and extraction pipeline runs. Persisted Factory objects currently remain candidate Production Memory records, not Published Memory.

Import preview and execute remain behavioral states, not persisted Factory lifecycle states.

Publication Candidate Pipeline completion, Governance handoff, Historical Library admission, Published Memory generation, and public timeline generation remain uncertified lifecycle stages.

## Future Architecture
Factory lifecycle documentation should distinguish:
- Factory object production state.
- Publication Package handoff state.
- Historical Library admission state.
- Feedback Package return state.

## Dependencies
- `docs/factory/FACTORY_CONSTITUTION.md`
- `docs/factory/PUBLICATION_PIPELINE.md`
- `docs/factory/FACTORY_ARTIFACT_MODEL.md`
- `docs/governance/PUBLICATION_LIFECYCLE.md`

## Open Questions
- Which lifecycle terms should be shared between Factory and Historical Library?
- Which Feedback Package states require editorial governance?

## Future Evolution
Lifecycle terms must preserve Factory/Library separation and must not collapse Production Memory into Published Memory.
