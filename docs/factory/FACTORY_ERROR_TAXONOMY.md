# Factory Error Taxonomy

Authority Level: Factory Operational
Governed System: Factory doctrine error classes.
Describes: Future Architecture

## Scope
This document defines doctrine-level Factory error categories.

## Non-Scope
This document does not replace current API error codes, define runtime handlers, or propose implementation mechanics.

## Product Identity
Factory errors are classified to protect chronological knowledge quality before Production Memory reaches Published Memory.

## Factory Doctrine
Factory errors belong to Production Memory and must be auditable when they affect Factory objects, Publication Packages, or Feedback Packages.

## Historical Object Doctrine
Historical Object errors concern identity, type, persistence through time, or participation in Milestones.

## Milestone Doctrine
Milestone errors concern chronology, canonical knowledge unit identity, central relationship-node behavior, or milestone evidence.

## Timeline View Doctrine
Timeline View errors concern narrative composition from Milestones and Historical Objects.

## Publication Package Doctrine
Publication Package errors concern admission readiness for the Historical Library.

## Feedback Package Doctrine
Feedback Package errors concern amendment return, correction interpretation, dispute handling, or preservation of Published Memory signals.

## Tiered Source Authority
Source errors must distinguish missing evidence, weak source tier, publisher authority conflict, provenance loss, and claim support failure.

## Current Reality
Factory runtime now classifies and persists operational failures for candidate generation runs, including provider timeout failures, runtime execution failures, and output validation failures. These classifications support failed pipeline step auditability inside Factory Production Memory.

Current import and API services also emit validation errors, `ApiError` responses, and structured logs. Factory-specific error taxonomy remains doctrine-level and may become more complete as publication candidate and Governance handoff workflows are certified.

## Future Architecture
Factory error classes should align to constitutional objects: Historical Object, Milestone, Timeline View, Relationship, Source, Publisher Authority, Publication Package, Feedback Package, and Factory Audit.

## Dependencies
- `docs/factory/FACTORY_CONSTITUTION.md`
- `docs/factory/VALIDATION_PIPELINE.md`
- `docs/factory/FACTORY_AUDIT_MODEL.md`

## Open Questions
- Which doctrine errors block Publication Package admission?
- Which Feedback Package errors return to editorial governance?

## Future Evolution
Error taxonomy may become more specific, but it must remain subordinate to the Factory Constitution.
