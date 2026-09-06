# TL-KF-V2-A3.4 — Gap-Aware Authoritative Source Admission

Status: **OUTCOME B — LOCALLY VERIFIED; LIVE SOURCE ADMISSION NOT CERTIFIED**

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

## Live evidence and mandatory hard stop

The frozen candidate was committed as `ce76fe76d5160e49d64d1f2088d45ca8cead889a`. The compare-and-set configuration migration advanced the SHADOW bundle from `.10/.3/.9/.8` to `.11/.3/.10/.8` while keeping publication, Governance submission, and autonomous discovery disabled. A subsequent plan-only check reproduced the exact seven known material gaps and five bounded completion tasks with zero writes.

Exactly one authorized Web A3 live execution then ran:

- run: `v2-a3-web-cbe1e74f-2030-4c0d-8170-30178f73dab3`;
- terminal projection: `FAILED / A1_SCHEMAS / FAIL`;
- failure: `FAILED_UNCLASSIFIED`, severity `CRITICAL`;
- failure record: `failure-51ee4947f78d5b64b5c789a0d119c85b8898ead2cea769835fb107a11de74e4b`;
- blocker: `v2ResearchMaps/research-map-34efed2ab3bbaa364138468c77d54998b5e303f9a13ac04fea2b8ef8695679ce: Immutable artifact ID collision with a different payload.`

Read-only reconstruction proved the collision precisely. The new completion map retained semantic artifact ID `research-map-34efed2ab3bbaa364138468c77d54998b5e303f9a13ac04fea2b8ef8695679ce`, but the attempted `.2` envelope for this run sealed to payload hash `77c3d02394cf3af26fa2aa3067b101ccf81724ae6e5caaf9084d2a89ff720aa2`. The existing `.1` artifact from run `v2-a3-web-98332efd-8842-490f-8ecd-d080d8789862` has payload hash `93ab19f1843caf33f12d7110ea067ce4ec906cf31b9a6fcc1abd4281f709c060`. The repository correctly rejected mutation of that immutable document.

The run persisted its initial coverage audit, completion plan, reconnaissance record, failure record, and closed failure projection. It created no run-scoped Research Map, Query Plan, admission audit, model execution, acquisition, source snapshot, atomic claim version, or canonical event version. Therefore the new source-admission path was never reached and cannot be certified from live evidence.

The cost-control rule now prohibits any patch, A3 rerun, or B1 invocation. B1 and B2 were not invoked. The machine-readable failure record is `artifacts/factory-v2/v2-a3-4-web-hard-stop.json`.

## Security and production boundary

The implementation does not alter retrieval. HTTPS, credential rejection, SSRF/private-network protection, DNS rebinding checks, TLS, robots, redirect limits, response-size/content-type enforcement, safe HTML/PDF extraction, prompt-injection isolation, private archiving, and server-only Firestore writes remain covered by passing tests. Publication, Governance submission, autonomous discovery, and all public write paths remain disabled.

## Read-only closure validation

- `factoryV2/config` is `SHADOW` at `.11/.3/.10/.8`; deterministic configuration hash `af4b770b54cc6de28c01511c731bf686a7d4e20e70f57dbc584cc93550d09561`; publication, Governance submission, and autonomous discovery are `false`.
- Cloud Scheduler job `topic-discovery-daily` is `PAUSED`, schedule `0 3 * * *`, timezone `UTC`.
- Corpus `v2TopicOperations` contains zero `RUNNING` operations.
- Published Memory remains 4 records and zero Factory V2 records. Its full-document comparison hash is `7389246e4ff622e0183a38e89874b50e47a1a0b85e3ef447ffd39eac1a323275`.
- Platform read models remain 46 records and zero Factory V2 records. Their full-document comparison hash is `8cb51b3a8c6fb2eed37ebdcbd23d15c1650455427678487fcf244c986fa223e9`.
- Cuban Missile Crisis topic/job `7d83e1b9dd32107a1b95c67a79e8edfb710583b0` / `a5c29a9e-aac2-4f37-9d08-072e52d1ae40` remain `AWAITING_REVIEW / governance_review` at `2026-09-05T18:45:03.650Z`.
- Apollo 13 topic/job `8f8c58de52e5e8b8d1f6efbb16fb98c62c0ed47f` / `1190ca33-e1cc-4e30-b3da-f0d0268989ae` remain `AWAITING_REVIEW / governance_review` at `2026-09-05T19:34:27.044Z`.
- No Governance submission, Historical Library admission, Published Memory write, public projection write, autonomous discovery, deployment, or `main` merge occurred.

## Certification result

| Area | Status | Evidence | Remaining risk |
|---|---|---|---|
| Gap relevance | LOCAL PASS | Focused ranking tests and explicit `gapRelevance` audit component | Live path not reached |
| Temporal fit | LOCAL PASS | Locked phase labels/rules and bounded observed-year scoring; focused tests | Live path not reached |
| Event utility | LOCAL PASS | Discrete-action signal component; no hardcoded milestones; focused tests | Live path not reached |
| Authority eligibility | LOCAL PASS | Explicit eligible, provisional, orientation-only, and prohibited states | Live path not reached |
| Publisher quality | LOCAL PASS | Verified publisher state and primary/secondary tendency remain scored | Live calibration not observed |
| Diversity | LOCAL PASS | Deterministic round-robin allocation; diversity subordinate to utility | Live candidate distribution not observed |
| Prohibited-source handling | LOCAL PASS | Wikipedia remains discovery metadata but is excluded before retrieval/extraction | Live exclusion audit not produced |
| Source replacement | LOCAL PASS | Unavailable or unusable source falls through to next-ranked usable candidate | Live replacement not exercised |
| Deterministic ranking | LOCAL PASS | Canonical-URL tie-break and reversed-input focused test | External search results remain inherently variable |
| A3 Web | FAIL | Single run failed closed at immutable Research Map persistence | Source admission never executed |
| Admitted sources | NOT OBSERVED | Zero admission audits and zero acquisition artifacts for the run | No live admission evidence |
| Supported claims | NOT OBSERVED | Zero new claim versions for the run | No knowledge completion evidence |
| Event candidates | NOT OBSERVED | Zero new event versions for the run | No chronology evidence |
| Final Web coverage | NOT CERTIFIED | No final coverage audit or completion result was produced | Seven initial material gaps remain unclosed by this run |
| B1 revalidation | NOT REVALIDATED | Hard-stop rule barred B1 after A3 failure | V2-B remains uncertified |
| Security | PASS | Existing retrieval controls unchanged; emulator/security/integration 5/5 | Live retrieval was not reached |
| Production integrity | PASS | Disabled capability flags, paused scheduler, zero running residue, unchanged public inventories and protected reviews | SHADOW config remains on the new compatible bundle |
| Remaining budget defect | OPEN / OUT OF SCOPE | Extraction ceiling 8 and completion maximum 5 remain unchanged | A later separately authorized goal must resolve it |

A3.4 GAP-AWARE SOURCE ADMISSION: **NOT CERTIFIED**

V2-A3 KNOWLEDGE COVERAGE: **NOT CERTIFIED**

V2-B B1: **NOT REVALIDATED**

V2-B: **NOT CERTIFIED**

Exact blocker: the completion Research Map uses a stable semantic document ID while its immutable sealed payload contains run/policy provenance; the pre-existing `.1` payload occupies that ID, so the `.2` live payload was rejected before source admission.

**STOP — RETURN CONTROL TO FOUNDER.**
