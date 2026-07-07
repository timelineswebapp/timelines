# Editorial Intelligence Certification

Version: 2.0

Status: Active Certification Record

Date: 2026-07-07

## Purpose

This document is the permanent repository record for Editorial Intelligence certification across EI-001 through EI-005. It records only repository-backed implementation and certification evidence.

Editorial certification belongs to the Factory and produces technical evidence. It does not approve publication, replace Governance, modify Factory Production Memory, or create historical authority.

## Certification Framework

Framework version: `editorial-certification-v1`

Machine command: `npm run ops:editorial:certify`

Persistence:

* `factory_editorial_certification_runs`
* `factory_editorial_certification_case_results`
* `factory_editorial_certification_invariant_results`

Certification records are immutable. Each case persists exact inputs, expected and actual fingerprints, compiler and algorithm versions, output, and individual invariant results.

Database migrations:

* `db/migrations/20260716_editorial_certification_foundation.sql`
* `db/rollbacks/20260716_editorial_certification_foundation_rollback.sql`

## Epic Status

| Epic | Implementation | Certification | Dependency Status |
|---|---|---|---|
| EI-001 — Editorial Intelligence Foundation | Complete | Repository-backed completion recorded | Satisfied |
| EI-002 — Editorial Timeline Compiler | Complete | Certified — Tier A | Satisfied for EI-003 |
| EI-003 — Editorial Composition | Complete | Certified — Tier A | Satisfied for EI-004 |
| EI-004 — Editorial Writer | Complete | Certified — Tier A | Satisfied for EI-005 |
| EI-005 — Editorial Intelligence End-to-End | Complete | Certified — End-to-End | Satisfied for institutional completion |

EI-005 certification is the end-to-end Editorial Intelligence institutional certification. It certifies the complete Editorial Intelligence chain through EI-004 and does not replace Governance.

## EI-001 Record

Status: Completed

Repository-backed capabilities include deterministic historical significance evaluation, evidence ranking, coverage and chronology analysis, turning-point identification, duplicate suppression, canonical subject and historical object selection, milestone prioritization, gap detection, balance analysis, and persisted Editorial Evidence Sets.

EI-001 supplies the exact Editorial Evidence Set lineage consumed by EI-002.

## EI-002 Record

Status: Certified

Implementation: Complete

Repository Integration: Complete

Determinism: Certified

Persistence: Certified

Pipeline Integration: Certified

Tier A Corpus: Certified

Machine Certification: Certified

Dependency for EI-003: Satisfied

### Certified Implementation

* deterministic Editorial Timeline Compiler;
* deterministic compiler adapter;
* canonical grounded milestone selection;
* deterministic chronology ordering and stable tie-breaking;
* deterministic duplicate suppression;
* compiler fingerprint stability;
* selection and exclusion preservation;
* immutable Editorial Timeline Candidate persistence;
* exact Editorial Evidence Set and extraction lineage;
* compiler artifact ownership;
* package dependency verification;
* package lineage subset verification;
* Governance exclusion of Editorial Timeline Candidate;
* certification repository and orchestration service;
* immutable certification migrations and rollback;
* machine-readable certification command.

The Editorial Timeline Candidate is non-authoritative, unpublished Factory Production Memory. It contains references and provenance; it does not create facts, editorial interpretation, or publication authority.

### Tier A Certification

Corpus version: `ei-002-tier-a-v1`

Historical subjects:

* Roman Republic
* Printing Press
* Meiji Restoration
* Internet

Cases passed: 4 / 4

Invariants passed: 52 / 52

Certification status: Certified

Persisted certification: Success

Certification run ID: `b5c4bc1d-c283-444d-8011-d5a122aa4d9d`

### Certified Invariants

Each corpus case records and passes the following invariants:

1. Compiler execution
2. Deterministic output
3. Duplicate suppression
4. Chronology ordering
5. Fingerprint stability
6. Editorial Evidence Set lineage
7. Extraction lineage
8. Compiler candidate persistence
9. Package dependency
10. Package lineage subset
11. Compiler artifact ownership
12. Compiler exclusion preservation
13. Governance candidate exclusion

## Institutional Boundary

## EI-003 Record

Status: Certified

Implementation and Factory integration: Complete

Corpus: `ei-003-tier-a-v1`

Cases passed: 8 / 8

Invariants passed: 176 / 176

Persisted certification run: `660ac578-a571-49a5-9d1d-6ca3586ff1f1`

Machine command: `npm run ops:editorial:certify -- --epic EI-003`

Certified behavior includes deterministic output and fingerprints, exact EI-002 chronology and membership preservation, exclusion preservation, phase integrity, EI-001 turning-point lineage, continuity, transitions, arcs, structural-only boundaries, absence of generated content, immutable persistence equality, exact resume reuse, artifact ownership, package lineage, and Governance exclusion.

EditorialComposition remains immutable, unpublished, non-authoritative Factory Production Memory.

## EI-004 Record

Status: Certified

Implementation and Factory integration: Complete

Corpus: `ei-004-tier-a-v1`

Cases passed: 4 / 4

Invariants passed: 112 / 112

Persisted certification run: `773889f8-cc36-4514-a3b1-fedf9deb1c2a`

Corpus fingerprint: `9ba2799e185caded9a2d676946fe9b72a3c8fd4977b9fa79d5c1e51b6dc4dbc3`

Machine command: `npm run ops:editorial:certify -- --epic EI-004`

Certified behavior includes exact prompt, policy, provider, WriterInput, evidence, sentence, citation, resume, generation-unit, revision, artifact, package, Factory ownership, and Governance exclusion invariants.

EditorialNarrative remains immutable, unpublished, non-authoritative Factory Production Memory.

## EI-005 Record

Status: Certified

Certification kind: Editorial Intelligence End-to-End

Certification version: `editorial-end-to-end-v1`

Corpus version: `editorial-end-to-end-tier-a-v1`

Machine command:

`npm run ops:editorial:certify -- --scope end-to-end`

Certified behavior includes complete Editorial Intelligence execution from validated evidence through Editorial Narrative package readiness before Governance. It verifies stage order, deterministic execution, writer determinism, prompt lineage, policy lineage, provider lineage, evidence lineage, claim lineage, citation lineage, package lineage, artifact ownership, governance-ready package integrity, fingerprint stability, revision identity, resume determinism, chronology integrity, composition integrity, milestone preservation, compiler invariants, Governance exclusion, and Factory ownership boundaries.

EI-005 does not certify Historical Library admission, Published Memory, Projection Engine, Search, Public APIs, or Public Platform.

Editorial Intelligence remains inside the Factory before Governance:

Factory → Governance → Historical Library → Published Memory → Platform

EI-002 does not modify Governance, Historical Library, Published Memory, or Platform authority. Selected milestone references remain packageable authority inputs; the Editorial Timeline Candidate itself is excluded from Governance authority mapping.

## Institutional Completion Status

Editorial Intelligence is complete and certified as a Factory-owned technical institution. Future editorial quality improvements must preserve certified lineage, deterministic execution, and Governance boundaries.
