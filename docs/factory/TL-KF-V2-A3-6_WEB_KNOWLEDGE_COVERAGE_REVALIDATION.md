# TL-KF-V2-A3.6 — Web Knowledge Coverage Revalidation

Status: **OUTCOME A — PRE-LIVE BLOCKER; NOT EXECUTED**

Execution boundary: read-only preflight only; no live A3 or B1 execution

Starting implementation commit: `ed6ef4599af37310f74c25776df0238d559c6e05`

Machine evidence: [`v2-a3-6-pre-live-blocker.json`](../../artifacts/factory-v2/v2-a3-6-pre-live-blocker.json)

## Result

The A3.6 live sequence was stopped before SHADOW configuration activation because the frozen existing B1 Web runner cannot consume or prove lineage to the A3 coverage-completed knowledge set required by this goal.

`scripts/factory-v2/run-v2b-b1-web.ts` hard-codes `SOURCE_RUN_ID = 8b40de60-ad95-4d74-886c-1ffb0e1e585d`, the original 1989–1994-only V2-A Web run. Every Scope Contract, Research Map, Event Version, Claim Version, Authority Verdict, and Conflict Set loaded by B1 is queried with `where("runId", "==", SOURCE_RUN_ID)`. The B1 context also records that same old run as `sourceKnowledgeRunId`.

The A3 runner, by contrast, creates a fresh completion run ID, loads its newly created semantic Claim/Event versions by the exact returned artifact IDs, evaluates final coverage over the union of original and new knowledge, and persists those exact new Claim/Event IDs in the completed knowledge-set artifact. B1 accepts no completion-result ID, final coverage-audit ID, candidate-ID list, or fresh completion run ID. Therefore it cannot select over the required union and cannot satisfy the explicit A3.6 B1 input-integrity rule.

Running A3 despite this known discrepancy would create a conditional path that could only silently fall back to the old candidate set if A3 passed. That is expressly prohibited. Runtime modification, B1 modification, or a parameterization patch is also expressly prohibited by this revalidation-only goal. The pre-live discrepancy rule therefore requires Outcome A and an immediate stop.

## A3.5 baseline

- Branch: `codex/tl-content-reset-001`.
- Local HEAD, upstream, and `origin/codex/tl-content-reset-001`: `ed6ef4599af37310f74c25776df0238d559c6e05` before this evidence-only commit.
- The A3.5 checkpoint is an ancestor of HEAD and is the exact active implementation commit.
- Worktree was clean; no `.DS_Store` existed; `git diff --check` passed.
- `main` and `origin/main`: `36c0ba7bc587cc1f40caab20e203c596395241da`.
- Rollback tag `pre-tl-kf-v2-a`: `a925c456d4bf41fd2fdca458d9f7256a4f06244b`.
- Repository bundle remains exactly the A3.5-certified successor: pipeline `factory-v2-a.12`, schema `factory-v2-a.4`, policy `evidence-first-v2-a.11`, prompt `factory-v2-a-prompts.8`; B schema `factory-v2-b.2`.
- The A3.5 report and machine audit remain the authoritative local/emulator certification evidence: strict TypeScript PASS, V2-A 78/78, B1 10/10, and Java 21 Firestore emulator 5/5.

The minimum pre-live test sequence was not repeated after the static discrepancy was found. The goal explicitly requires stopping rather than repairing a pre-live code discrepancy, and the checkout is byte-identical to the already-certified A3.5 implementation commit. No Java emulator rerun was necessary.

## Pre-live blocker evidence

The frozen code has incompatible input contracts for the conditional B1 step:

| Required lineage | A3 runner behavior | Existing B1 runner behavior | Verdict |
|---|---|---|---|
| Original compatible knowledge | Uses fixed original run `8b40de60-ad95-4d74-886c-1ffb0e1e585d` | Uses the same fixed original run | Available |
| Fresh completion knowledge | Receives exact new claim/event IDs from the fresh A3 acquisition | Does not accept or load them | Missing |
| Completed knowledge set | Persists initial/final audit IDs and exact new Claim/Event IDs | Accepts no completion-result reference | Missing |
| Candidate input union | Final A3 audit evaluates original plus new knowledge | B1 queries only artifacts whose `runId` equals the old source run | Invalid |
| B1 lineage proof | Required before B1 | Can only record the old run ID | Impossible with frozen runner |

This is a **CONFIGURATION / INPUT-LINEAGE preflight defect**, not live model, Grounding, source-admission, retrieval, or semantic-identity evidence. It does not revoke A3.5 semantic-identity certification because no identity invariant was exercised or contradicted.

## SHADOW activation and execution

- Compare-and-set configuration migrations performed: **0**.
- Live config remained `.11/.3/.10/.8`.
- A3 Web runs performed: **0**.
- B1 Web runs performed: **0**.
- B2 runs performed: **0**.
- Five-fixture suites performed: **0**.
- Vertex/Gemini calls: **0**.
- Grounding calls: **0**.
- Source retrievals: **0**.
- Production/Factory writes: **0**.
- Configuration writes: **0**.

Because activation never occurred, the implementation/configuration freeze was never entered and no post-activation mutation was possible. The known `claimExtractions` budget defect was not changed or exercised.

## Fresh production-safety evidence

Read-only checks at `2026-09-06T20:33:52.598Z` established:

- `factoryV2/config` remains `SHADOW` at `.11/.3/.10/.8` with deterministic full-config hash `af4b770b54cc6de28c01511c731bf686a7d4e20e70f57dbc584cc93550d09561`;
- publication, Governance submission, and autonomous discovery are all `false`;
- the configured budget bundle is unchanged;
- Cloud Scheduler `topic-discovery-daily` is `PAUSED`, schedule `0 3 * * *`, timezone `UTC`;
- corpus `v2TopicOperations` contains zero `RUNNING` operations;
- Published Memory contains 4 total documents, zero Factory V2 documents, with canonical full-document comparison hash `7389246e4ff622e0183a38e89874b50e47a1a0b85e3ef447ffd39eac1a323275`;
- platform read models contain 46 total documents, zero Factory V2 documents, with canonical full-document comparison hash `8cb51b3a8c6fb2eed37ebdcbd23d15c1650455427678487fcf244c986fa223e9`;
- Cuban Missile Crisis topic/job remain `AWAITING_REVIEW / governance_review` at `2026-09-05T18:45:03.650Z`;
- Apollo 13 topic/job remain `AWAITING_REVIEW / governance_review` at `2026-09-05T19:34:27.044Z`;
- `main` and `origin/main` remain `36c0ba7bc587cc1f40caab20e203c596395241da`.

No public timeline, Governance record, Historical Library record, Published Memory document, public projection/read model, protected review, scheduler, or discovery state was changed.

## Final report

| Area | Status | Evidence | Remaining risk |
|---|---|---|---|
| Certified baseline | PASS | Exact A3.5 implementation commit, clean/equal branch baseline, intact main/tag | None observed in certified implementation surface |
| Bundle activation | NOT EXECUTED | Zero CAS migrations; live config remains `.11/.3/.10/.8` | `.12/.4/.11/.8` remains inactive |
| A3.5 semantic identity | CERTIFIED | Existing local/emulator certification; no contrary live evidence | Not live-revalidated in A3.6 |
| Initial coverage | NOT EXECUTED | No A3 run | Known Web gaps remain the latest applicable evidence |
| Gap planning | NOT EXECUTED | No A3 run | Not revalidated |
| A3.4 source admission | NOT LIVE-CERTIFIED | No A3 run or retrieval | Existing local evidence only |
| Prohibited-source handling | NOT EXECUTED | No admission/extraction | Not live-revalidated |
| Retrieval | NOT EXECUTED | Zero retrievals | Not live-revalidated |
| Claim extraction | NOT EXECUTED | Zero extraction packets | Not live-revalidated |
| Source Authority | NOT EXECUTED | No new claims | Existing behavior unchanged |
| Conflicts | NOT EXECUTED | No new claims | Existing conflicts preserved |
| Event resolution | NOT EXECUTED | No new events | Later-period yield unknown |
| Later-period event yield | NOT EXECUTED | No A3 run | Missing chronology remains uncorrected by this goal |
| Final coverage | NOT CERTIFIED | No final re-audit | Web coverage remains uncertified |
| Reader sanity | NOT EXECUTED | A3 did not pass | No completed knowledge to inspect |
| B1 input lineage | FAIL — PRE-LIVE | Frozen B1 runner loads only fixed old run and accepts no completion artifact/IDs | Requires a separately authorized implementation correction |
| B1 selection | NOT REVALIDATED | B1 was not authorized after pre-live stop | V2-B remains uncertified |
| B1 reader sanity | NOT EXECUTED | No B1 output | Not applicable |
| Execution budget | NOT EXERCISED | No model/retrieval execution | Known extraction-budget defect remains open |
| Performance | NO LIVE COST | Zero live calls and writes | No new runtime measurements |
| Production integrity | PASS | Fresh config, scheduler, operation, public inventory/hash, and protected-review reads | Continue preserving SHADOW boundary |
| Source control | DOCUMENTATION/EVIDENCE ONLY | No runtime/config file changed | Evidence commit/push recorded at closure |

A3.5 SEMANTIC VERSION IDENTITY: **CERTIFIED**

A3.4 GAP-AWARE SOURCE ADMISSION: **NOT LIVE-CERTIFIED**

V2-A3 KNOWLEDGE COVERAGE: **NOT CERTIFIED**

V2-B B1: **NOT REVALIDATED**

V2-B: **NOT CERTIFIED**

Exact blocker: the frozen B1 Web runner cannot consume or prove lineage to the A3 completion result and would query only the old 1989–1994 source run. Correcting that contract is an implementation change outside A3.6 authority.

**STOP — RETURN CONTROL TO FOUNDER.**
