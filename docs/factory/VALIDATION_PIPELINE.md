# Validation Pipeline

Authority Level: Factory Architecture
Governed System: Factory validation doctrine for Historical Objects, Milestones, Timeline Views, sources, and packages.
Describes: Both

## Scope
This document governs Factory validation language and constitutional validation responsibilities.

## Non-Scope
This document does not implement validators, define schema, or prescribe execution infrastructure.

## Product Identity
Validation protects TiMELiNES as a Chronological Knowledge Platform by preventing weak chronological knowledge from entering Published Memory.

## Historical Object Doctrine
Validation must distinguish Historical Object identity, type, persistence through time, and participation in Milestones.

## Milestone Doctrine
Validation must protect Milestones as canonical chronological knowledge units. Chronology, identity, evidence, and central relationship-node behavior are core validation concerns.

## Timeline View Doctrine
Validation must confirm that Timeline Views are curated narrative views derived from Milestones and Historical Objects, not canonical containers.

## Relationship Doctrine
Relationships must explain history. Validation must evaluate whether relationships are meaningful, evidence-supported, and centered on Milestones where appropriate.

## Publication Package Doctrine
Validation supports Publication Package readiness for Historical Library admission. Validation does not itself publish.

## Feedback Package Doctrine
Validation must be able to evaluate Feedback Packages returned from Published Memory and preserve amendment provenance.

## Tiered Source Authority
Validation must apply Tiered Source Authority:
- Evidence must be present.
- Publisher authority must be evaluated separately from source existence.
- Source tier assumptions must be preserved.
- Weak or conflicting evidence must not be hidden.

## Current Reality
Factory runtime now validates structured worker output before Factory Production Memory persistence.

Implemented validation behavior:
- Worker output must parse as structured JSON.
- Required source attribution and evidence must be present.
- Candidate source payloads must include source identity, publisher, credibility, and traceability metadata.
- Invalid outputs fail closed before Factory object or artifact persistence.
- Validation failures are classified for pipeline step diagnostics.

Certified on 2026-06-22:
- Research pipeline output validation passed for candidate sources and context records.
- Extraction pipeline output validation passed for candidate historical objects, milestones, participations, relationships, and context records.

Zod still validates imports and admin payloads, the chronology parser still validates date semantics, and import duplicate detection remains a validation precedent. Factory worker-output validation is now implemented for certified candidate generation pipelines.

## Future Architecture
Factory validation doctrine covers Historical Objects, Milestones, Timeline Views, relationships, sources, publisher authority, Publication Packages, and Feedback Packages.

## Dependencies
- `docs/factory/FACTORY_CONSTITUTION.md`
- `docs/factory/RESEARCH_PIPELINE.md`
- `docs/factory/PUBLICATION_PIPELINE.md`
- `docs/governance/PROVENANCE_POLICY.md`
- `docs/governance/SOURCE_CREDIBILITY_POLICY.md`

## Open Questions
- Which source tier failures block Historical Library admission?
- Which Feedback Package validations return to editorial governance?

## Future Evolution
Validation documentation must preserve the constitutional model and must not reduce validation to import payload checks.
