# TL-KF-V2-A3.1 — Publisher Bootstrap Provenance Idempotency

Status: **A3.1 CERTIFIED LOCALLY; A3 KNOWLEDGE COVERAGE NOT CERTIFIED**

Execution boundary: non-public SHADOW only

Starting checkpoint: `02a0c40c2ad9a5be79788e41de1e464c7a9af1a3`

Forensic evidence: [`v2-a3-1-publisher-collision-forensic.json`](../../artifacts/factory-v2/v2-a3-1-publisher-collision-forensic.json)

Single-run failure evidence: [`v2-a3-1-web-failure-1788707205446.json`](../../artifacts/factory-v2/v2-a3-1-web-failure-1788707205446.json)

## Original A3 failure and exact collision

The original A3 run `v2-a3-web-f5b77650-0d9f-4740-aee1-3858ef113b6f` failed before acquisition at `A1_SCHEMAS`. `V2FirestoreRepository.createImmutable` correctly rejected a conflicting payload for:

- collection: `v2PublisherAuthorityVersions`;
- document: `publisher-version-2096c38539b7bc836f6e43f4adf1ab1d8a359fd5334b9614179fec8e9791551a`;
- publisher: National Aeronautics and Space Administration;
- logical publisher ID: `8da035d0-01c9-58ef-8242-5a50696e84a1`;
- existing/attempted version: `2` / `2`;
- existing hash: `381e3e9c3d0236c93cfb02610b15f8c09ecebb2475c8efe4bf8de2eb40ef3783`;
- attempted hash: `a88c50c132962677478d67e14fd3ea24245c263ffacb041fc26d145cabcec41c`.

The exact semantic publisher fields were equal. The only direct field difference was `policyVersion`: the existing bootstrap used `evidence-first-v2-a.9`, while the A3 caller supplied `knowledge-coverage-v2-a3.1`; `payloadHash` consequently differed. No existing immutable record was modified.

## Root-cause classification and repair

Classification: **A — same semantic artifact / non-semantic caller provenance difference**.

`bootstrapPublisherRegistry` derived the publisher version ID using the fixed Source Authority policy but inherited `ArtifactContext.policyVersion` into the immutable payload envelope. A topic execution policy therefore changed the payload without changing its ID. The repair explicitly binds bootstrap authority artifacts to `V2_POLICY_VERSION`, so topic/run provenance cannot alter semantic registry state.

The repository collision check and compare-and-set behavior were not changed. There is no overwrite, delete, last-write-wins path, mismatch suppression, or reinterpretation of historical records.

## Publisher versioning and compatibility

`buildPublisherAuthorityVersion` now provides the narrow successor-version path for legitimate authority changes. It:

- preserves the logical publisher identity, parent publisher, and independence group;
- requires an explicit version and semantically meaningful `effectiveAt`;
- includes version, authority policy, and normalized semantic authority state in the new content identity;
- canonicalizes set-like arrays, external identifiers, and domains before hashing;
- leaves semantically ordered arrays order-sensitive;
- creates a distinct immutable version without mutating the old version;
- relies on the existing repository compare-and-set head operation.

Existing bootstrap artifacts remain byte compatible. Direct reconstruction of the production NASA bootstrap record produced the same ID and exact payload hash `381e3e9c…`. No bulk rewrite or configuration migration occurred.

## Version boundary

The bundle remains exactly `.10/.3/.9/.8` and the production config hash remains `74f7c68c70a612300a7c855f9fc51b02d7dbbe85b0a5299eedf1bcaaf926c8e2`.

This is intentional: the repair restores the already-certified publisher authority semantic contract and produces byte-identical existing artifacts. It changes neither schema, authority policy, prompt, nor pipeline semantics. Advancing the bundle would create a false semantic version boundary and make the explicitly unchanged B1 gate incompatible. Therefore the previous and new bundle/config hash are identical and no compare-and-set configuration migration is required.

## Local and emulator proof

Before the live call:

- focused V2-A tests passed **62/62**;
- unchanged B1 tests passed **8/8**;
- Functions typecheck passed;
- `git diff --check` passed;
- the forensic artifact parsed as valid JSON;
- direct legacy compatibility reconstruction matched the production publisher ID/hash;
- Firestore emulator/security/integration tests passed **4/4** under Java 21.

The emulator covered unauthenticated browser denial, full SHADOW orchestration, immutable creation/idempotency, exact mismatch rejection, publisher retry, concurrent equivalent bootstrap convergence, successor version creation, version-head advancement, stale-head compare-and-set rejection, reference integrity, and corpus isolation.

## Single A3 Web revalidation

Exactly one fresh `npm run v2a3:web` invocation was made. It failed after approximately four seconds at the first A3 persistence write, `scripts/factory-v2/run-v2a3-web.ts:73`, before entering the V2-A orchestrator or reaching publisher bootstrap.

The pre-existing semantic coverage audit ID was:

`knowledge-coverage-audit-b2add78d0157400a49c991bca5ef6f570d919665a8c997ac4b61264341a4a7b6`

Its existing hash is `00429511d33f27186699bb1562a064d5f3ac0dca6c4fc5886f5c4d9712dc50e6`. Static inspection shows the ID is computed from semantic audit inputs, while the sealed payload additionally includes execution-specific `runId`, `createdAt`, and measured `auditMs`. Recreating the same semantic initial audit in a fresh execution therefore reused the ID with a different payload. Immutable persistence correctly failed closed.

This is a separate coverage-audit identity defect. It is outside the authorized publisher/bootstrap implementation boundary. In accordance with the mandatory hard-stop rule, it was not patched and A3 was not rerun.

The failed attempt made zero Grounding calls, provider queries, retrievals, claims, or events. It persisted no new artifacts. The existing counts remain one coverage audit, one completion plan, zero completion results, and one ranked candidate set. Monetary cost is not measurable; no provider work occurred.

## B1 disposition

B1 required a passing A3 final audit. That prerequisite was not met. B1 was not modified, invoked, or revalidated. B2 was not started.

## Production integrity

Pre- and post-run read-only audits agree:

- Factory V2 remains SHADOW `.10/.3/.9/.8` with publication, Governance submission, and autonomous discovery disabled;
- `topic-discovery-daily` remains `PAUSED` on `0 3 * * *` UTC;
- zero RUNNING V2 operations;
- zero V2 Published Memory and zero V2 public projections;
- Published Memory remains 4 records with comparison hash `006d346031773dc6f1cba400a62215a3e9874b2567b26dae0acd3f4eef01d21c`;
- platform read models remain 46 records with comparison hash `172596509263f477c1756d57cd87c8c2e453d6bb3b536f3f45e98002235444f1`;
- Cuban Missile Crisis and Apollo 13 topic/job records remain `AWAITING_REVIEW / governance_review` at `2026-09-05T18:45:03.650Z` and `2026-09-05T19:34:27.044Z`;
- no public timeline, Historical Library, Governance, Published Memory, or projection write occurred;
- `main` remains `36c0ba7bc587cc1f40caab20e203c596395241da`;
- rollback tag `pre-tl-kf-v2-a` remains intact.

## Final verdict

**A3.1: CERTIFIED**

**V2-A3 KNOWLEDGE COVERAGE: NOT CERTIFIED**

**V2-B B1: NOT REVALIDATED**

**V2-B: NOT CERTIFIED**

The next authorized work is a separately approved, narrow correction for immutable Knowledge Coverage Audit identity/provenance semantics. B1 and B2 remain unauthorized.
