# Editorial Intelligence Certification

Version: 1.0

Status: Active Certification Record

Date: 2026-07-05

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
| EI-003 | Not completed | Not certified | Next active phase |
| EI-004 | Not completed | Not certified | Planned |
| EI-005 | Not completed | Not certified | Planned |

No future epic certification is claimed.

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

Editorial Intelligence remains inside the Factory before Governance:

Factory → Governance → Historical Library → Published Memory → Platform

EI-002 does not modify Governance, Historical Library, Published Memory, or Platform authority. Selected milestone references remain packageable authority inputs; the Editorial Timeline Candidate itself is excluded from Governance authority mapping.

## Future Certification

EI-003, EI-004, and EI-005 remain uncertified. Their certification records must be added only after repository-backed implementation and persisted certification evidence exist.
