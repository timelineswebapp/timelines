# TL-KF-V2-A3.7 — Completed Knowledge Set → B1 Lineage

Status: **OUTCOME C — ZERO-LIVE-CALL CERTIFIED**

Execution boundary: local tests, Java 21 Firestore emulator, and read-only production verification only

Starting checkpoint: `f815c4813b9d29489b91c009352f56a6a3514626`

Machine evidence: [`v2-a3-7-b1-lineage-certification.json`](../../artifacts/factory-v2/v2-a3-7-b1-lineage-certification.json)

## Result

B1 now selects from one explicit verified knowledge universe. The caller must provide `topicId` and `completedKnowledgeSetId`; an expected set hash may also be supplied. B1 resolves only that immutable artifact and the exact IDs it contains. Missing input, invalid identity, incompatible semantic versions, hash failure, topic/corpus/scope/map/audit mismatch, non-passing coverage, missing references, duplicate canonical event membership, and incomplete claim/verdict/conflict closure all stop execution before model evaluation or selection persistence.

The Completed Knowledge Set remains a server-only Factory technical artifact. It authorizes an input universe for B1; it is not Historical Library authority, Governance approval, Published Memory, public historical truth, or a public projection.

## A3.6 blocker reconstructed

The prior Web B1 runner declared `SOURCE_RUN_ID = 8b40de60-ad95-4d74-886c-1ffb0e1e585d`. It queried Scope Contracts, Research Maps, Event Versions, Claim Versions, Authority Verdicts, and Conflict Sets with `where("runId", "==", SOURCE_RUN_ID)`, then recorded that run as the source universe.

A3 instead creates a completion execution, re-audits the union of original and completion knowledge, and persists exact semantic Claim/Event identities. Before A3.7, B1 accepted no completion-result identity, final audit identity, or exact membership. A successful A3 run could therefore have been followed by B1 silently selecting the stale 1989–1994 pool. Repository code and the A3.6 blocker artifact prove this was an input-lineage defect, not a selection-policy defect.

## Corrected contract

The existing `v2KnowledgeCompletionResults` artifact family is refined in schema `factory-v2-a.5` as `CompletedKnowledgeSet`; no duplicate authority collection is introduced. Legacy `.3/.4` completion results remain parseable as historical evidence but are not valid current B1 inputs.

The semantic artifact contains:

- exact Scope Contract ID/hash and final Research Map ID/hash;
- completion plan and initial/final Coverage Audit IDs, with both audit hashes;
- final coverage verdict and unresolved gap IDs;
- canonicalized exact Event Version, Claim Version, Authority Verdict, and Conflict Set membership;
- Factory pipeline, schema, semantic policy, corpus, topic, and generation identity;
- an independent deterministic payload hash.

All membership arrays are unique and lexically canonicalized before semantic identity is calculated. Equivalent set membership in a different input order converges to the same artifact. A changed candidate member, semantic parent, audit, schema, or policy creates a distinct immutable version. Run IDs, timestamps, acquisition round labels, timing, budget, and provider executions do not define membership and remain in A3 execution/audit evidence.

Successful A3 output now emits `topicId`, `completedKnowledgeSetId`, `completedKnowledgeSetHash`, and `finalCoverageAuditId`. A3 still uses its existing bounded coverage/acquisition semantics; no coverage, source admission, Source Authority, event resolution, or budget rule changed.

## B1 validation and reconstruction

`reconstructCompletedKnowledgeSetForB1` accepts only the explicit contract. It performs bounded exact document reads in batches of at most 50 and never exposes a topic query, latest query, run query, or fallback path. It validates:

1. stored set existence, payload hash, semantic content-addressed identity, current `.13/.5` compatibility, corpus/topic/generation, and optional caller expectations;
2. exact completion-plan → initial-audit → original-map and final-map → final-audit lineage;
3. Scope and Research Map IDs and payload hashes;
4. final audit stage, hash, exact candidate membership, unresolved gaps, and `SUFFICIENT` verdict;
5. every exact Event, Claim, Verdict, and Conflict reference and payload hash;
6. Event-to-Claim, core-Claim-to-Verdict, Conflict-to-Claim, and final-audit cell references;
7. one membership per canonical event identity and one exact Authority Verdict per Claim Version.

The resulting deterministic `candidateInputHash` covers the set, Scope, Map, final audit, and every loaded candidate/supporting artifact ID/hash. B1 Selection Artifacts and selection-model executions now record the completed-set ID/hash, final-audit ID/hash, candidate-input hash, exact candidate IDs, selection policy, and the unchanged selection result. `sourceKnowledgeRunId` is `null` for current B1 artifacts.

## Runner contract and no fallback proof

The Web runner now requires:

```text
npm run v2b:b1:web -- \
  --topic-id <topic-id> \
  --completed-knowledge-set-id <completed-knowledge-set-id> \
  --expected-completed-knowledge-set-hash <completed-knowledge-set-hash>
```

The hash argument is optional at schema level because B1 always recomputes the persisted payload hash, but A3.8 should pass it to bind the handoff output explicitly. Missing required flags fail before configuration reads, model calls, or writes. The historical Web run constant and every `where("runId", ...)` input query were removed from the B1 executable.

## Regression and semantic-version evidence

The synthetic local certification creates an old valid knowledge set whose candidates end in 1994 and a new valid set containing a 2024 candidate. Both coexist and can be explicitly consumed. B1 reconstruction of the new ID includes the later candidate, does not read old-only membership, and does not read an additional valid same-topic candidate stored outside the set.

The same suite proves missing CLI/set input, nonexistent ID, topic mismatch, expected hash mismatch, Scope mismatch, final-audit mismatch, tampered payload, non-passing result, non-final audit, missing candidate, and cross-corpus input all fail closed. Membership order and execution-only retries converge. Distinct membership produces distinct completed-set IDs, candidate-input hashes, and B1 Selection Artifact IDs. Existing B1 eligibility, significance, coverage, temporal balance, redundancy, omission, event limits, and prompt reasoning remain unchanged.

## Version decision

The Completed Knowledge Set persisted contract changes, so the proposed A3.8 successor is pipeline `factory-v2-a.13`, schema `factory-v2-a.5`, policy `evidence-first-v2-a.11`, prompt `factory-v2-a-prompts.8`. The policy and prompt do not advance because knowledge/coverage meaning is frozen; `.5` is an artifact-contract boundary while unchanged V2-A artifact families retain their certified `.4` constructors.

B1 advances to pipeline `factory-v2-b.2` and schema `factory-v2-b.3` because its required input and output lineage contracts change. Selection policy remains `evidence-backed-selection-v2-b.1` and prompt remains `factory-v2-b-prompts.1`. Historical B1 `.1/.2` artifacts and their source bundles remain parseable and untouched; new writes require explicit completed-set lineage.

No successor bundle was activated in production.

## Verification

- V2-A, A3 coverage, A3.4 admission, and A3.5 semantic-version suite: **78/78 PASS**.
- B1 behavior plus new lineage suite: **14/14 PASS**.
- Functions strict TypeScript: **PASS**.
- Java: OpenJDK `21.0.11`.
- Firestore emulator/security/integration: **6/6 PASS**.
- Emulator coverage: persistence, exact load, immutable v1/v2 coexistence, idempotency, extra same-topic exclusion, missing-reference failure, corpus isolation, and unauthenticated browser denial.
- `git diff --check`: **PASS**.

The final emulator pass used isolated Firestore port `8180` because an unrelated workspace emulator owned the default `8080`; one intervening launcher attempt exited before tests because its child command could not resolve `tsx`. Neither attempt contacted production or changed repository/runtime state.

No Vertex/Gemini call, Grounding call, source retrieval, A3 fixture, B1 live fixture, live configuration write, deployment, production-content write, Governance submission, publication, or public projection occurred.

## Production integrity

Read-only checks at `2026-09-06T23:15:55.513Z` confirmed:

- live Factory V2 remains SHADOW at `.11/.3/.10/.8`; publication, Governance submission, and autonomous discovery are `false`;
- `topic-discovery-daily` remains `PAUSED`, `0 3 * * *`, UTC;
- zero RUNNING V2 operations;
- Published Memory remains 4 records, zero V2, hash `7389246e4ff622e0183a38e89874b50e47a1a0b85e3ef447ffd39eac1a323275`;
- platform read models remain 46 records, zero V2, hash `8cb51b3a8c6fb2eed37ebdcbd23d15c1650455427678487fcf244c986fa223e9`;
- the single historical failed B1 selection artifact remains the only `v2RankedCandidateSets` record;
- Cuban Missile Crisis remains `AWAITING_REVIEW / governance_review` at `2026-09-05T18:45:03.650Z`;
- Apollo 13 remains `AWAITING_REVIEW / governance_review` at `2026-09-05T19:34:27.044Z`;
- `main` and `origin/main` remain `36c0ba7bc587cc1f40caab20e203c596395241da`.

## A3.8 handoff (documented, not executed)

A3.8 may perform one separately authorized live sequence only after its own preflight:

```text
cd functions
npm run v2a:bootstrap-shadow -- --apply --expected-current-pipeline-version factory-v2-a.11
npm run v2a3:web
```

If and only if that one A3 run returns `status: PASS`, retain its exact `topicId`, `completedKnowledgeSetId`, `completedKnowledgeSetHash`, and `finalCoverageAuditId`, perform the authorized bounded reader sanity, then invoke exactly:

```text
npm run v2b:b1:web -- \
  --topic-id <exact-A3-topicId> \
  --completed-knowledge-set-id <exact-A3-completedKnowledgeSetId> \
  --expected-completed-knowledge-set-hash <exact-A3-completedKnowledgeSetHash>
```

B1 will revalidate the final audit identity/hash and exact membership before its one selection call. Stop after that B1 result. A3.7 does not authorize activation or either command.

## Certification verdict

**A3.7 COMPLETED KNOWLEDGE-SET → B1 LINEAGE: CERTIFIED**

**A3.5 SEMANTIC VERSION IDENTITY: CERTIFIED**

**A3.4 GAP-AWARE SOURCE ADMISSION: IMPLEMENTED / NOT YET LIVE-CERTIFIED**

**V2-A3 KNOWLEDGE COVERAGE: NOT YET CERTIFIED**

**V2-B B1: NOT REVALIDATED**

**V2-B: IN PROGRESS / NOT CERTIFIED**

Next potential separately authorized goal: **TL-KF-V2-A3.8 — Web A3 + Explicit-Lineage B1 Revalidation**.

**STOP — RETURN CONTROL TO FOUNDER.**
