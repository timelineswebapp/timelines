# TL-KF-V2-A3 — Knowledge Coverage Completion

Status: **NOT CERTIFIED**

Execution boundary: non-public SHADOW only

Starting checkpoint: `d8b4dd88aab9d852e65cd95ed7bdebccde859721`

Live evidence: [`v2-a3-web-1788696514095.json`](../../artifacts/factory-v2/v2-a3-web-1788696514095.json)

## Authorized correction and prior failure

The prior V2-B Gate B1 Web run correctly failed with 11 eligible candidates concentrated in 1989–1994. It selected eight events but left the three locked phases from 2000 through the ongoing 2026 boundary unrepresented, producing blocking coverage, omission, staleness, and early-concentration findings. That negative evidence remains unchanged in [`TL-KF-V2-B_EVIDENCE_BACKED_TIMELINE_ASSEMBLY.md`](./TL-KF-V2-B_EVIDENCE_BACKED_TIMELINE_ASSEMBLY.md) and `v2-b1-web-1788694242715.json`.

This A3 checkpoint makes knowledge coverage an explicit upstream V2-A responsibility. It does not change B1 selection logic and does not implement V2-B selected-event evidence completion. V2-A3 asks whether enough authoritative candidate knowledge exists across the locked scope; future V2-B B2 asks whether already selected events have the exact evidence required for publication.

## Implemented coverage model

The additive coverage contracts and deterministic audit are implemented under `functions/src/factory-v2/contracts/coverage.ts` and `functions/src/factory-v2/coverage.ts`. They evaluate the locked Scope Contract and Research Map against supported Atomic Claims, Source Authority verdicts, material conflicts, chronology-eligible canonical Event/Milestone candidates, question provenance, and durable snapshot freshness metadata.

Coverage states are `SUFFICIENT`, `WEAK`, `MISSING`, `NOT_APPLICABLE`, and `BLOCKED`. Required phases demand at least one supported chronology-eligible event; supported non-event claims remain knowledge but leave a phase weak. Required dimensions may be satisfied by authoritative claims and do not require artificial chronology entries. Material conflicts remain blocking. Non-required cells do not block. Ongoing staleness is derived from absence in the latest locked phase, not from a universal elapsed-year threshold; closed topics have no ongoing recency gate.

Phase boundaries are derived from locked phase labels/rules. The system does not divide time into equal buckets and contains no expected Web milestone names. Candidate reuse keeps only the newest immutable version for a canonical event identity and does not destructively merge history.

## Gap model and bounded acquisition

The audit emits explicit gaps linked to locked phase, dimension, and question IDs, existing supporting claims, and a reason. Supported codes include missing/weak phase knowledge, missing/weak dimension knowledge, missing chronology, ongoing staleness, unanswered critical questions, and blocking material conflicts.

Gap tasks derive only from topic title, locked phase label/rule, locked dimension, Research Map relationships, and authority class. A versioned completion Research Map preserves its immutable parent. Continuation mode in the existing V2-A orchestrator skips broad Scope/Research Map proposal and Query Plan generation, then reuses the same certified Grounding, safe retrieval, durable snapshot, claim extraction, Source Authority, conflict, entity resolution, and canonical event resolution path.

The one-round A3 budget is:

| Resource | Ceiling |
|---|---:|
| Completion rounds | 1 |
| Gap questions / Grounding calls | 5 / 5 |
| Provider queries | 25 |
| Source documents | 30 |
| Claim extraction packets | 5 |
| Atomic claims | 100 |
| Worker time | 480 seconds |

The global certified V2-A ceilings were not increased.

## Local verification

Before the live call:

- focused V2-A tests passed 58/58, including nine A3 coverage tests;
- unchanged V2-B B1 tests passed 8/8;
- Functions typecheck passed;
- Firestore emulator/security/integration command exited 0;
- `git diff --check` passed;
- a read-only `--plan-only` Web audit made no writes, reproduced the exact five material phase/dimension gaps, derived five tasks, and left zero material gaps unplanned;
- static inspection found no milestone-specific production logic and no public application import of the A3 implementation.

## Single live Web fixture

Exactly one live A3 Web fixture was started:

- run: `v2-a3-web-f5b77650-0d9f-4740-aee1-3858ef113b6f`;
- source knowledge: `8b40de60-ad95-4d74-886c-1ffb0e1e585d`;
- initial audit: `knowledge-coverage-audit-b2add78d0157400a49c991bca5ef6f570d919665a8c997ac4b61264341a4a7b6`;
- completion plan: `knowledge-completion-plan-b6807d65eb0194aa1c1a0271c69cbbd8571c4d4b043c7b0b0a46573251850ef4`;
- failure record: `failure-9fa1a01dea8a3e66934d9e4d1c49357196665df54177c9320c30284dd742781b`.

The persisted initial audit deterministically reproduced:

| Locked coverage | State |
|---|---|
| 1989–1993 phase | SUFFICIENT |
| 1993–2000 phase | SUFFICIENT |
| 2000–2010 phase | MISSING |
| 2010–2020 phase | MISSING |
| 2020–Present phase | MISSING |
| Technological Development | SUFFICIENT |
| Key Individuals and Institutions | SUFFICIENT |
| Societal and Cultural Impact | WEAK |
| Economic Impact | MISSING |
| Policy and Governance | SUFFICIENT |

The latest chronology event remained 1994 and ongoing freshness was `STALE_LOCKED_PHASE`. Five locked-scope tasks covered the three missing phases and two dimension gaps, with no unplanned material gap.

## Failure and cost/performance evidence

The fixture failed at `A1_SCHEMAS`, before Grounding or acquisition, with:

`v2PublisherAuthorityVersions/publisher-version-2096c38539b7bc836f6e43f4adf1ab1d8a359fd5334b9614179fec8e9791551a: Immutable artifact ID collision with a different payload.`

The continuation context used the A3 coverage policy provenance while bootstrap publisher IDs remain derived from the certified V2-A policy constant. The resulting envelope differed under an existing immutable ID. This is the concrete blocking defect; immutable persistence correctly failed closed. Per the one-fixture hard-stop rule, it was not patched and the fixture was not rerun.

The operation failed after 2,595 ms. Incremental usage was zero Grounding calls, zero provider queries, zero retrievals, zero claim-extraction calls, zero new claims, and zero new events. Monetary cost remains `NOT_MEASURABLE`; no provider work occurred. No final coverage audit or completion result exists.

## B1 disposition

B1 revalidation was authorized only after a passing final A3 audit. That prerequisite was not met. B1 was not modified, invoked, or revalidated. B2 and all later V2-B work remain prohibited.

## Production integrity

The post-failure read-only audit passed:

- factory config remains SHADOW `.10/.3/.9/.8` with publication, Governance submission, and autonomous discovery disabled;
- `topic-discovery-daily` remains `PAUSED` on `0 3 * * *` UTC;
- zero RUNNING V2 operations;
- zero V2 Published Memory and zero V2 public projections;
- Published Memory remains 4 records with local comparison hash `7389246e4ff622e0183a38e89874b50e47a1a0b85e3ef447ffd39eac1a323275`;
- public platform read models remain 46 records with local comparison hash `8cb51b3a8c6fb2eed37ebdcbd23d15c1650455427678487fcf244c986fa223e9`;
- Cuban Missile Crisis and Apollo 13 topic/job records remain `AWAITING_REVIEW / governance_review` at their protected timestamps;
- the prior single failed B1 selection artifact remains the only `v2RankedCandidateSets` record;
- the A3 run added one immutable initial audit, one immutable completion plan, one failed operation, and one immutable failure record; it added no research map, query plan, acquisition, claim, event, completion-result, institutional, or public artifact;
- `main` remains `36c0ba7bc587cc1f40caab20e203c596395241da` and the rollback tag remains intact.

## Final verdict

**V2-A3 KNOWLEDGE COVERAGE: NOT CERTIFIED**

**V2-B: NOT CERTIFIED**

**B1 NOT REVALIDATED**

The next authorized work is a separately approved A3 correction for the immutable publisher-bootstrap provenance collision. No rerun is authorized in this goal.
