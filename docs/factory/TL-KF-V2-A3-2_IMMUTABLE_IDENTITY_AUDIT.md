# TL-KF-V2-A3.2 — Immutable Artifact Identity Audit

Status: **IDENTITY AUDIT CERTIFIED; SINGLE LIVE A3 FAILED; HARD STOP APPLIED**

Execution boundary: non-public SHADOW only

Starting checkpoint: `61348e79e6d5b581c370204f72d112afb293a590`

Machine-readable inventory: [`v2-a3-2-immutable-identity-audit.json`](../../artifacts/factory-v2/v2-a3-2-immutable-identity-audit.json)

## Governing classification

Every implemented V2-A, V2-A3, and V2-B B1 Firestore type was classified as one of:

- semantic/version artifact: historical or editorial meaning plus explicit immutable lineage;
- execution/provenance artifact: one observed run, attempt, response, timing, or diagnostic;
- mutable identity/head or operational projection: compare-and-set/upsert state, not `createImmutable` content.

The payload hash remains SHA-256 over canonical JSON after schema normalization, excluding only the `payloadHash` field. Object keys sort recursively, arrays retain semantic order, finite numbers are enforced, and negative zero normalizes to zero. Repository behavior remains exact: an existing ID is idempotent only when the payload hash matches; a different payload under the same ID is rejected.

## Identity matrix

| Artifact / collection | ID basis | Semantic payload | Execution provenance | Version/head | Verdict |
|---|---|---|---|---|---|
| Scope Contract | run/generation/version/payload/model ref | locked scope | run/time/model | versioned | PASS after fix |
| Scope Amendment Proposal | no implemented builder | proposed scope change | envelope | versioned | REVIEW_REQUIRED; unused |
| Research Map | scope/hash/map/model ref | locked research structure | run/time/model | versioned | PASS after fix |
| Research Task | deterministic delivery | none | lease/attempt/state/time | mutable operation | PASS |
| Query Plan | map/normalized plan/model ref | bounded queries/budget | run/time/model | immutable | PASS after fix |
| Acquisition Run | query + exact model execution | attributed acquisition result | queries/budget/counts | execution | PASS |
| Acquisition Discovery | query + exact model execution | attributed source discovery | provider response | execution | PASS |
| Publisher Authority head | logical publisher | current version pointer | updatedAt | CAS head | PASS |
| Bootstrap Publisher version | publisher/authority state/fixed policy | authority version | fixed registry origin | versioned | PASS; A3.1 retained |
| Provisional Publisher version | domain/state/fixed policy | provisional authority | fixed registry origin | versioned | PASS after fix |
| Publisher successor version | publisher/version/policy/normalized state | authority successor | semantic effectiveAt | versioned + CAS head | PASS |
| Source Document | canonical URL | source identity/current snapshot | updatedAt | mutable head | PASS |
| Source Snapshot | exact retrieval observation | durable snapshot | URL/redirect/time/headers/access | versioned observation | PASS after fix |
| Evidence Segment | snapshot + exact span/selectors | evidence text | snapshot-origin provenance | immutable child | PASS |
| Atomic Claim head | logical proposition | current claim version | updatedAt | CAS head | PASS |
| Atomic Claim version | run/claim/payload/model ref | atomic assertion | run/time/model | versioned | PASS after fix |
| Claim Evidence edge | claim version/segment/relationship | evidentiary relation | transitive origins | immutable edge | PASS |
| Claim Authority verdict | claim/evidence set/policy | authority decision | transitive claim run | immutable | PASS |
| Conflict Set | conflict key/sorted claims/evidence | preserved conflict | transitive claim run | immutable | PASS |
| Canonical Entity head | logical entity | current version pointer | updatedAt | CAS head | PASS |
| Canonical Entity version | run/entity/payload/model ref | candidate entity | run/time/model | versioned | PASS after fix |
| Entity Alias edge | entity version/alias/language | alias relation | entity-version origin | immutable edge | PASS |
| Canonical Event head | logical event | current version pointer | updatedAt | CAS head | PASS |
| Event/Milestone candidate version | run/candidate/payload/identity/model ref | canonical candidate | run/time/model | versioned | PASS after fix |
| Event Claim edge | event/claim/role | claim membership | transitive versions | immutable edge | PASS |
| Event Entity edge | event/entity/role | participation | transitive versions | immutable edge | PASS |
| Event Relation edge | no implemented builder | typed relation | envelope | immutable edge | REVIEW_REQUIRED; unused |
| V2-A Model Execution | exact execution envelope and result | none | model/prompt/response/attempt/usage/timing | execution | PASS after fix |
| B1 Model Execution | exact execution payload | none | prompt/response/attempt/usage/timing | execution | PASS after fix |
| Failure Record | exact failure observation | none | stage/class/attempt/budget/message | execution | PASS after fix |
| Audit Record | run/action/exact decision inputs | none | policy actor/diagnostic | execution | PASS |
| Topic Operation | run ID | none | mutable stage/count/time | mutable projection | PASS |
| Reconnaissance Record | topic/run-scoped scope/exact bounded result | reusable-knowledge snapshot | scope/run | immutable observation | PASS |
| B1 Selection Artifact | exact envelope/model/result | deterministic selection | run/time/model | immutable execution result | PASS after fix |
| Standalone selection Coverage Cell | no implemented schema/write | future selection coverage | none | unimplemented | REVIEW_REQUIRED; unused |
| Timeline View Specification | no implemented B1 write | future editorial view | none | future version | PASS outside current surface |
| Timeline Event Membership | no implemented B1 write | future membership | none | future | PASS outside current surface |
| Knowledge Coverage Audit | exact execution envelope/result/timing | coverage observation | run/time/auditMs | execution audit | PASS after fix |
| Coverage Cell / Gap | complete normalized semantic value | coverage finding | none | nested value | PASS |
| Knowledge Completion Plan | exact run/parent/budget/tasks | bounded gap plan | run/time | execution-bound plan | PASS after fix |
| Gap Task | complete normalized task | bounded acquisition intent | none | nested value | PASS |
| Knowledge Completion Result | exact run/result/counters/timings | completed knowledge lineage | run/resource/timing telemetry | execution result | PASS after fix |

The three `REVIEW_REQUIRED` entries have no implemented A3/B1 write path. They were not modified. There are zero unresolved `DEFECT_CONFIRMED` cases in the live A3 execution path.

## Confirmed defect class and correction

The static audit found 15 affected artifact variants:

1. provisional publisher policy provenance;
2. Scope Contract model provenance;
3. Research Map model provenance;
4. Query Plan model provenance;
5. Source Snapshot retrieval observation;
6. Atomic Claim model provenance;
7. Canonical Entity model provenance;
8. Canonical Event model provenance;
9. V2-A model execution telemetry;
10. B1 model execution telemetry;
11. failure execution telemetry;
12. B1 selection execution provenance;
13. Knowledge Coverage Audit execution provenance;
14. Knowledge Completion Plan execution provenance;
15. Knowledge Completion Result execution provenance.

The correction introduces a reusable `executionArtifactId` function that hashes the exact variable execution payload together with run context and fixed SHADOW invariants. Execution records now receive a new identity when any recorded attempt, usage, timing, or result changes. Exact replay receives the same identity and payload.

Model-derived semantic artifacts now include their exact immutable `modelExecutionRef` in version identity because that provenance remains part of their sealed payload. Provisional publishers explicitly use `V2_POLICY_VERSION`. Source Snapshot IDs cover the complete immutable retrieval observation. Coverage audits, plans, results, failures, and B1 artifacts cover the execution provenance they persist.

No immutable repository check, hash verification, public boundary, authority threshold, coverage rule, acquisition strategy, resolution rule, significance rule, or omission rule changed.

## Compatibility and version decision

Existing immutable records remain readable, valid historical evidence and untouched. No record is rewritten, deleted, or silently reinterpreted. Corrected IDs apply only to artifacts built after this checkpoint; all references continue to carry exact IDs and hashes.

The persisted shape is unchanged, so the schema remains `.3`. Historical/authority policy and prompts are unchanged, so policy `.9` and prompt `.8` remain. The SHADOW pipeline/config remains `.10` because this is an identity-construction correction within the existing contract, not a new knowledge or execution topology. No compare-and-set config migration is required. The audit itself is explicitly versioned `immutable-identity-audit-v1`.

## Local and emulator evidence

Pre-live verification:

- V2-A/identity tests: **69/69 PASS**;
- unchanged B1 semantic tests plus identity regression: **10/10 PASS**;
- Functions typecheck: **PASS**;
- Firestore emulator/security/integration under Java 21: **5/5 PASS**;
- identity inventory: **42 artifact entries**, 39 PASS, 3 unused REVIEW_REQUIRED, zero unresolved A3-path defects;
- no-write Web plan: reproduced seven locked coverage gaps, derived five bounded tasks, left zero material gaps unplanned, and persisted nothing;
- `git diff --check`: **PASS**.
- machine-readable audit SHA-256: `cf070af59e2c57c11aa5bdde33555ab0ea3e72561e53d562a8dc8fbfd20b51cc`.

Tests cover exact replay, different run/time/latency/usage, model provenance, publisher bootstrap and provisional publishers, source observations, initial/final coverage audits, gap plans, completed knowledge results, B1 selection, actual concurrent equivalent writes, conflict rejection, version-head advancement, stale-head failure, reference integrity, corpus isolation, and unauthenticated browser denial.

## Live results

Exactly one authorized `npm run v2a3:web` invocation ran against **The History of the World Wide Web** from frozen candidate commit `2aed9bb11b37b8c140e242da8cc28a288732d255`.

The identity repair held: the initial audit, completion plan, final audit, and all acquisition artifacts persisted without an immutable collision. The run executed five Grounding calls and 25 provider queries, retrieved nine source documents, created five new durable snapshot observations, performed eight claim-extraction calls, and produced 37 claims (15 supported), one conflict, and one non-chronology `STATE_LEGACY` event candidate.

The final coverage audit persisted as `knowledge-coverage-audit-386ff51128d7c07514169f5756481928f2d6d557fc571014eac7a2bb306c5da7` with payload hash `e2571baab3bbf1d05301209d718ad17fe8fd991deff422d7a3a49786d9b48fac`. Its verdict remained `KNOWLEDGE_COVERAGE_INSUFFICIENT`: all three later locked phases remained weak, Economic Impact remained weak, critical questions remained unanswered, the latest chronology event remained 1994, and ongoing freshness remained `STALE_LOCKED_PHASE`.

The process then failed at completion-result schema validation because the observed `budgetConsumed.claimExtractions` value was 8 while the schema maximum is 5. No Knowledge Completion Result persisted. Exact evidence is preserved in [`v2-a3-2-web-failure-1788709811712.json`](../../artifacts/factory-v2/v2-a3-2-web-failure-1788709811712.json).

The mandatory hard stop applies. A3 was not rerun, B1 was not invoked, and B2 was not started.

## Production integrity after failure

- Factory V2 remains SHADOW `.10/.3/.9/.8`; publication, Governance submission, and autonomous discovery remain disabled.
- `topic-discovery-daily` remains `PAUSED` on `0 3 * * *` UTC.
- Zero RUNNING V2 operations, zero V2 Published Memory, and zero V2 public projections.
- Published Memory remains 4 records with comparison hash `006d346031773dc6f1cba400a62215a3e9874b2567b26dae0acd3f4eef01d21c`.
- Platform read models remain 46 records with comparison hash `172596509263f477c1756d57cd87c8c2e453d6bb3b536f3f45e98002235444f1`.
- Cuban Missile Crisis and Apollo 13 topic/job records remain `AWAITING_REVIEW / governance_review` at `2026-09-05T18:45:03.650Z` and `2026-09-05T19:34:27.044Z`.
- No public, Governance, Historical Library, Published Memory, or projection write occurred.

## Final verdict

**A3.2 IMMUTABLE IDENTITY AUDIT: CERTIFIED**

**V2-A3 KNOWLEDGE COVERAGE: NOT CERTIFIED**

**V2-B B1: NOT REVALIDATED**

**V2-B: NOT CERTIFIED**
