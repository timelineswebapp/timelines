# TL-KF-V2-A3.4 — Gap-Aware Authoritative Source Admission

Status: **IMPLEMENTED LOCALLY; LIVE REVALIDATION PENDING**

Execution boundary: non-public SHADOW only

Starting commit: `7e4c68da20267aa0ef55360af6df219ac660a3c3`

## Forensic baseline and authorized correction

The authoritative A3.3 audit identified SOURCE admission as the primary reason the Web completion run produced 15 supported claims but no chronology-eligible later event. This checkpoint changes only coverage-completion source admission and directly required private telemetry/tests. Claim extraction, Source Authority thresholds, event resolution, coverage semantics, B1 selection semantics, query ceilings, and extraction ceilings remain unchanged.

## Admission model

The completion-only admission path deterministically evaluates every discovered candidate against each exact locked question. Its explainable components are:

- `gapRelevance`: overlap with locked phase, dimension, and question-specific terms;
- `temporalFit`: locked phase-label matches and observed years inside derived locked phase bounds;
- `eventUtility`: bounded linguistic signals for discrete actions such as launches, releases, adoptions, announcements, publications, standards, decisions, conferences, and deployments;
- `authorityEligibility`: `ELIGIBLE_FOR_EVIDENCE`, `PROVISIONAL`, `ORIENTATION_ONLY`, or `CATEGORICALLY_PROHIBITED`;
- `publisherQuality`: verified publisher state and primary/secondary tendency;
- `roleAndClass`: requested query role and source class;
- `retrievability`: HTTPS eligibility with a penalty for generic homepages.

No historical milestone is hardcoded. Ties use canonical URL, so semantically set-like candidate ordering cannot change admission. Retrieval candidates are selected round-robin by per-question rank under the unchanged source-document ceiling, preventing an early question from exhausting the shared budget. Diversity is no longer a forced choice ahead of utility; equally useful authoritative sources from one domain may both rank ahead of a materially weaker second domain.

## Prohibited sources and replacement

Wikipedia and any publisher marked orientation-only remain present in immutable acquisition-discovery metadata and in private admission-decision audits. They are excluded from retrieval/extraction capacity for coverage certification and Source Authority remains unchanged downstream.

Eligible and provisional candidates remain rankable. The bounded retrieval pool includes next-ranked candidates within the existing source-document budget. After retrieval, sources with no usable evidence or `UNAVAILABLE` disposition are skipped and the next ranked usable candidate is selected. Private audit records explain admission, prohibition, budget exclusion, retrieval failure/host suppression, post-retrieval usability, selection, and replacement.

## Observability

Existing private `v2AuditRecords` persist the new decisions without introducing a schema shape:

- `COVERAGE_SOURCE_ADMISSION` records question ID, URL hash, publisher domain, eligibility, rank, disposition, exclusion reason, component vector, temporal signals, and event signals;
- `COVERAGE_SOURCE_RETRIEVAL` records failed or host-circuit-suppressed retrieval and replacement availability;
- `COVERAGE_SOURCE_POST_RETRIEVAL` records source/snapshot, score, cache disposition, usability, and extraction selection or replacement.

This supplies auditable reasons without exposing a public artifact or pre-certifying any claim.

## Versioning

- Pipeline: `factory-v2-a.10` → `factory-v2-a.11`.
- Source/authority policy bundle: `evidence-first-v2-a.9` → `evidence-first-v2-a.10`.
- Coverage operation policy: `knowledge-coverage-v2-a3.1` → `knowledge-coverage-v2-a3.2`.
- Admission policy: new private `gap-aware-source-admission-v1`.
- Schema remains `factory-v2-a.3`; prompt remains `factory-v2-a-prompts.8`.
- B1 semantics and B1 `.1` versions are unchanged; only its source-bundle compatibility binding advances to the new V2-A bundle.

## Local pre-live evidence

- Focused reliability tests: 6/6 pass.
- V2-A tests, including A3 coverage and A3.2 identity: 73/73 pass.
- Unchanged B1 behavioral tests: 10/10 pass.
- Firestore emulator/security/integration under Java 21: 5/5 pass.
- Functions strict TypeScript: pass.
- `git diff --check`: pass.
- Query limits, extraction `.slice(0, 8)` behavior, and the separate completion maximum of 5 are unchanged. The `claimExtractions=8` execution-budget defect remains intentionally unresolved.

## Live evidence

Pending the frozen candidate commit, compare-and-set SHADOW configuration update, and exactly one authorized Web A3 execution.

## Security and production boundary

The implementation does not alter retrieval. HTTPS, credential rejection, SSRF/private-network protection, DNS rebinding checks, TLS, robots, redirect limits, response-size/content-type enforcement, safe HTML/PDF extraction, prompt-injection isolation, private archiving, and server-only Firestore writes remain covered by passing tests. Publication, Governance submission, autonomous discovery, and all public write paths remain disabled.
