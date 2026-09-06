# TL-KF-V2-A1 checkpoint

Checkpoint date: 2026-09-06
Branch baseline: `28a0c66` (`feat(factory): add V2-A evidence-first shadow engine`)
Execution boundary: non-public SHADOW only
Verdict: `TL-KF-V2-A: NOT CERTIFIED`

## Checkpoint disposition

The diagnostic patch-and-fixture loop was stopped on operator instruction. The active Apollo 11 process was interrupted and operation `dc956a4b-906a-4d28-8f84-102ac4c3c01a` was atomically changed from `RUNNING` to `FAILED` with blocking reason `OPERATOR_INTERRUPTED_DIAGNOSTIC_CHECKPOINT`. Its immutable artifacts were retained. A subsequent read found zero RUNNING V2 operations.

The unproven chronology-orientation implementation was removed before this checkpoint. That removal included its deterministic chronology question, reserved orientation query, and `.9` version bump. Production shadow configuration was compare-and-set from `.9` back to the coherent repository version `.8`; no other remediation was reverted.

No deployment, public write, Governance transition, review-item transition, production-content edit, autonomous-discovery action, or `main` change was performed.

## Changes since `28a0c66`

### Acquisition, evidence, and reliability

- `functions/src/factory-v2/reliability.ts` adds deterministic question-focused evidence-packet ranking, diverse bounded source admission, global concurrency control, per-host serialization, and a host circuit breaker.
- `functions/src/factory-v2/acquisition/retrieval.ts` wires immutable snapshot reuse and conditional ETag/Last-Modified revalidation, records explicit cache dispositions, rejects schema-incompatible cached snapshots, and prefers `<main>` while removing navigation/header/footer/aside/form chrome before exact segmentation.
- `functions/src/factory-v2/repositories/firestore.ts` adds bounded lookup of reusable source/snapshot/segment bundles.
- `functions/src/factory-v2/orchestrator.ts` caps claim-extraction work at eight question/source packets, interleaves first sources across questions, records cache and research-question coverage audits, enforces a ten-minute whole-run deadline and bounded stage timeouts, prevents new work after deadline, closes caught failures instead of leaving stale RUNNING operations, and emits structured retrieval diagnostics.
- `functions/src/factory-v2/contracts/knowledge.ts` adds bounded private model-response provenance and the explicit `WHOLE_RUN_DEADLINE_EXCEEDED` failure class. `firestore.indexes.json` exempts the bounded response body from indexing.

### Model contracts and deterministic ownership

- `functions/src/factory-v2/vertex.ts` reduces provider schemas to semantic output. Software now owns Scope entity IDs; Research Map phase/dimension/question IDs, state, closed claim/source ontologies, and locked-label resolution; and Query Plan IDs, roles, question references, and result/provenance fields.
- Research Map proposals with labels outside the locked Scope are discarded; deterministic software adds only the missing questions required to cover locked phases and dimensions. This cannot expand scope.
- Provider-side array cardinalities that exceeded Vertex constrained-decoder state limits were removed while authoritative Zod limits remain enforced.
- Grounding retries empty/transport failures within the existing three-attempt cap and deduplicates provider-reported queries before persistence.
- Model executions now bind their actual input artifact IDs and persist a maximum 60,000-character response with truncation state, hashes, token counts, attempts, and latency.
- Claim extraction is question-specific and packet-bounded, validates proposed claims independently, retains valid siblings when another claim is malformed, rejects invented segment references, and records individual rejection reasons.
- `functions/src/factory-v2/contracts/builders.ts` replaces the over-broad conjunction rejection with typed multi-burden checks and gives equivalent propositions stable claim identity across wording/evidence versions.

### Authority and graph resolution

- `functions/src/factory-v2/authority.ts` deduplicates evidence edges before burden evaluation and hashing. Publisher registry versions are policy-bound and advanced through compare-and-set heads.
- `functions/src/factory-v2/orchestrator.ts` deduplicates persisted claim/evidence and identity-evidence references; accumulates equivalent-claim evidence; builds entity candidates only from supported evidence; and associates events/entities only when the canonical entity name occurs in the claim/evidence cluster.
- Canonical event candidates require supported `OCCURRENCE` or `INSTITUTIONAL_ACTION` evidence plus supported temporal evidence. `STATE_LEGACY`, `CONTEXT`, and `FUTURE` remain ineligible for chronology canonicalization, and out-of-scope temporal intervals are downgraded to non-event context.

### Configuration, tests, and diagnostics

- Versions advance from schema/policy/prompt/pipeline `.1` to schema `factory-v2-a.3`, policy `evidence-first-v2-a.7`, prompt `factory-v2-a-prompts.6`, and pipeline `factory-v2-a.8`.
- `scripts/factory-v2/bootstrap-shadow.ts` now requires an exact current pipeline version when updating an existing config and performs the update transactionally after rechecking all shadow safety flags.
- V2 unit and emulator fixtures were updated for semantic-only provider contracts, occurrence-plus-date event formation, cache/head successor behavior, evidence deduplication, stable proposition identity, independently rejected claim siblings, prompt isolation, deadline enforcement, and locked Research Map coverage.
- `functions/package.json` includes the new reliability suite in both Functions and focused V2-A tests.
- `artifacts/factory-v2/v2-a1-forensic-diagnostic.md` records the initial five-fixture failure analysis. The `v2-a-shadow-fixtures*.json` files preserve subsequent positive and negative live evidence without rewriting prior artifacts.

## Definitively fixed and test-covered defects

| Defect | Fixed behavior | Verification |
|---|---|---|
| Research Map decoder state explosion and model-authored persistence IDs/enums | Shallow semantic provider grammar; deterministic IDs, references, states, and ontologies; Zod remains authoritative | Focused V2-A tests |
| Missing or unlocked Research Map coverage | Unlocked-label questions are discarded; missing locked phase/dimension questions are deterministically added | Focused V2-A tests; exact coverage assertions |
| Query role/reference instability and duplicate provider queries | Roles/IDs/references are assigned in software; reported queries are deduplicated | Focused V2-A tests |
| One invalid proposed claim discarded valid siblings | Each proposed claim is validated independently with bounded rejection reasons | Focused V2-A tests |
| Over-broad conjunction atomicity rejection | Typed multi-evidentiary-burden and multi-sentence checks replace universal conjunction rejection | Focused V2-A tests |
| Claim identity changed with wording/evidence | Proposition identity excludes wording and extraction provenance while immutable claim versions retain both | Focused V2-A tests |
| Navigation-first evidence packets and global source selection | Question-relevant exact-segment ranking and diverse per-question source admission | Focused V2-A tests |
| Cache declared but not wired | Immutable reuse, schema compatibility, conditional validation, and cache audit dispositions | Focused tests and two-run emulator proof |
| Duplicate evidence/identity references | Durable edge and identity evidence deduplication | Focused tests and emulator proof |
| Unbounded aggregate run / stale RUNNING after caught errors | Ten-minute deadline, stage deadlines, bounded concurrency/circuits, explicit failure closure | Focused tests and emulator proof |
| Insufficient model diagnostics | Bounded response/input provenance plus hash, usage, attempts, and latency | Focused tests and schema validation |
| Event creation from unsupported/non-event material | Supported action plus time is mandatory; semantic class and locked interval gate canonicalization | Focused tests and emulator proof |
| Unsafe config overwrite | Transactional compare-and-set migration with safety-flag validation | Live `.9` → `.8` checkpoint restoration |

The required local checkpoint verification completed after the chronology patch was removed: focused V2-A tests 47/47, Firestore emulator/security/integration tests 3/3, Functions TypeScript typecheck PASS, and `git diff --check` PASS.

## Fixes additionally proven by successful live fixtures

The following are real Vertex/Grounding SHADOW results, not publication attempts. Successful runs prove the end-to-end behaviors present in their recorded bundles; they do not certify the later `.8` bundle.

- Pipeline `.2` successfully executed semantic Research Maps, bounded five-query plans, durable retrieval/snapshot/segment persistence, question-aware extraction, claim authority, entity resolution, event resolution, exact provenance, and final fail-closed verdict calculation for Web, Berlin Wall, Apollo 11, and Cuban Missile Crisis.
- The Web `.2` success recorded two cache hits, 28/28 supported claims, and 11 resolved canonical event candidates, proving live cache reuse and restored evidence/claim yield.
- Berlin Wall `.2` reached PASS with unique identity evidence and four resolved events, proving the duplicate-identity-evidence failure was removed in live execution.
- Apollo 11 `.2` reached PASS with a closed Scope, day-precision evidence, 13 supported claims, and one resolved event candidate.
- Cuban Missile Crisis first exposed duplicate provider-reported queries, then the `.2` successor run reached PASS with 26 supported claims and four resolved canonical events, proving provider-query deduplication in live execution. The code change occurred without a bundle bump, which is retained as a version-discipline defect in the negative evidence.
- Apollo 13 `.3` reached PASS after main-content extraction/cache changes, with 13 supported claims and two resolved canonical events. It recorded one cache refetch.
- Apollo 11 `.8` run `b6fe42ae-eee8-4cd6-9a58-5524a2e45494` passed Scope, Research Map, query, retrieval, claim, authority, conflict, and entity stages after the locked-label filter/backfill change. It then failed the event gate, so it is positive proof only for the earlier stages.

## Latest successful live result by required fixture

| Fixture | Latest PASS run | Pipeline / schema / policy / prompt | Key result |
|---|---|---|---|
| History of the World Wide Web | `bebc65d7-29b8-4a80-b6fc-aaf7416fdf1e` | `.2` / `.2` / `evidence-first-v2-a.2` / `prompts.2` | 336,322 ms; 5 snapshots; 28/28 supported claims; 11 resolved events; PASS |
| Fall of the Berlin Wall | `ccaa9af0-4081-48e0-9753-c4c85761dcec` | `.2` / `.2` / `evidence-first-v2-a.2` / `prompts.2` | 344,958 ms; 5 snapshots; 16 supported claims; 4 resolved events; PASS |
| Apollo 11 Mission | `5dc5b098-fd00-42d2-9d01-62143f071a8a` | `.2` / `.2` / `evidence-first-v2-a.2` / `prompts.2` | 251,717 ms; 4 snapshots; 13 supported claims; 1 resolved event; PASS |
| Cuban Missile Crisis | `3462b32e-efeb-4aa0-8056-08acfd521bd9` | `.2` / `.2` / `evidence-first-v2-a.2` / `prompts.2` | 342,104 ms; 6 snapshots; 26 supported claims; 4 resolved events; PASS |
| Apollo 13 Mission | `696935fc-ae2e-4043-b19a-bb66c1f38217` | `.3` / `.3` / `evidence-first-v2-a.3` / `prompts.3` | 279,294 ms; 2 snapshots; 13 supported claims; 2 resolved events; PASS |

There is no five-fixture PASS set under one bundle, and none of these older successes is represented as current `.8` certification evidence.

## Current Apollo 11 blocker

The latest completed `.8` Apollo 11 run is `b6fe42ae-eee8-4cd6-9a58-5524a2e45494`. It completed in 231,351 ms with five durable snapshots, 12 extracted claims, 12 supported claims, five entity candidates, three resolved entities, and zero event candidates. Its exact blocking reason is `NO_RESOLVED_EVENT_CANDIDATES`.

The evidence was authoritative enough for its narrow claims, but the selected research paths skewed toward crew identity, hardware composition, and broadcast audiences. None of the supported occurrence claims also carried the supported temporal evidence required for canonical EVENT resolution. This is a research targeting/yield defect, not an authority threshold defect, and the event gate correctly failed closed.

## Proposed correction — not implemented

The smallest proposed correction is to make chronology targeting an explicit deterministic acquisition obligation while preserving all evidence and authority gates:

1. prepend one software-owned locked-scope question requesting primary institutional evidence for dated occurrences within the exact Scope boundaries;
2. reserve the single `ORIENTATION` query slot for a deterministic title/chronology/date/official-history query bound to that question;
3. retain up to four model-proposed queries for phase, dimension, and authority breadth;
4. require the normal durable snapshot, exact segment, atomic claim, risk/type, authority, conflict, entity, semantic-class, and temporal gates before any event candidate can resolve.

This proposal was briefly implemented as `.9`, was not completed or accepted, and was fully removed at checkpoint instruction. It is documentation only and requires a separately authorized closure turn.

## Remaining V2-A certification blockers

1. Current pipeline `.8` has not produced a PASS for Apollo 11; its latest complete run has zero canonical event candidates.
2. All five required fixtures have not passed under one identical schema/policy/prompt/pipeline bundle.
3. The 20 cross-fixture hard invariants have not been recomputed and certified against one current uniform fixture set.
4. Current-bundle p50/p95 cannot be computed without a complete uniform successful set; older successes are approximately 4.2–5.7 minutes but span bundles.
5. The complete institutional/public regression suite was intentionally not rerun at this checkpoint; only the operator-requested minimum coherence checks were executed.
6. The primary V2-A implementation document and prior certification summary still describe the pre-remediation failure set and require final reconciliation after a successful closure run.
7. Durable queued `v2ResearchTasks` execution remains deferred; controlled Founder/Admin fixture invocation is the current bounded topology and must be explicitly accepted or completed before final certification.
8. The additive Firestore index exemption and backend changes are not deployed. This is acceptable for local controlled shadow execution but not proof of a deployed V2 runtime.
9. No current uniform fixture artifact exists that can support a final `CERTIFIED` verdict.

No evidence, Source Authority, locked-scope, security, conflict, temporal, or event-quality rule was weakened to reach this checkpoint.

## Production and safety state

The current `factoryV2/config` value is:

| Field | Value |
|---|---|
| operating mode | `SHADOW` |
| pipeline | `factory-v2-a.8` |
| schema | `factory-v2-a.3` |
| policy | `evidence-first-v2-a.7` |
| prompt | `factory-v2-a-prompts.6` |
| kill switch | `false` |
| autonomous discovery | `false` |
| publication | `false` |
| Governance submission | `false` |

Budgets remain 7 grounding calls, 40 provider queries, 60 source documents, 300 atomic claims, 2 semantic repairs, 3 transport attempts, concurrency 3, and 1,200 worker seconds. The configuration and code both refuse V2-A execution unless operating mode is SHADOW and autonomous/public/Governance capabilities are false. V2-A contains no publication or public-projection writer.

Cloud Scheduler job `topic-discovery-daily` remains `PAUSED` in `us-central1` on `0 3 * * *` UTC. Read-only production checks found four Published Memory records and 46 platform read-model records, with zero records carrying a `factory-v2-a*` pipeline. The protected Cuban Missile Crisis topic/job and Apollo 13 topic/job remain `AWAITING_REVIEW / governance_review` with their original timestamps `2026-09-05T18:45:03.650Z` and `2026-09-05T19:34:27.044Z`, respectively.

## Recommended smallest next closure goal

Authorize one bounded TL-KF-V2-A2 closure: implement and unit-test only the deterministic chronology obligation described above, advance the bundle once, run Apollo 11 as the sole targeted live gate, and stop immediately if it does not produce supported dated occurrence evidence plus at least one canonical EVENT. Only after that targeted PASS should the same immutable bundle be run once across the five required fixtures and audited for all hard invariants. No V2-B work, deployment, publication, Governance submission, review-item mutation, discovery resumption, or `main` merge belongs in that closure.

## Final checkpoint verdict

`TL-KF-V2-A: NOT CERTIFIED`

V2-B is not authorized and was not started.
