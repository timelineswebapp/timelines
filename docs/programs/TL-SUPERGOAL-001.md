# TL-SUPERGOAL-001 — Autonomous Tier-1 Production Completion

**Status:** ACTIVE — AUTHORIZED ENGINEERING EXECUTION
**Authority:** CTO execution index; subordinate to `Knowledge/AUTHORITY_INDEX.md`, the V2 canons, locked institutional records, and certification artifacts.
**Last reconciled:** 2026-10-16
**Related records:** `docs/programs/TL-TIER1-COMPLETION-001.md`; `docs/decisions/TL-AUTONOMY-001.md`.

## Purpose and control boundary

This is the durable execution index for the authorized Tier-1 completion program. It records current repository evidence and implementation progress; it neither supersedes constitutional/LOCK authority nor authorizes production deployment, launch, Registry expansion, new providers, or a change to the locked Phase-2 benchmark.

## Reconciled repository state

| Item | Current evidence |
|---|---|
| Prior program checkpoint | `6dea240` — `test: keep deferred reentry consumption unroutable` |
| Baseline implementation checkpoint | `24d4507a4e67718bc4363f409ce2973ad4e298d9` (`factory-v2-a.70`, Authority-First `.43`, schema `.15`, prompt `.21`) |
| Latest sealed Phase-2 evidence | The `.69` sealed run recorded the governed Berlin affected-community capacity boundary. It is not a four-subject certification. |
| Phase 2 | **UNCERTIFIED**. The locked four prescribed subjects / one materially equivalent sealed release / four valid CKS criterion is unchanged. |
| Autonomous discovery | Paused. |
| Publication and Governance submission | Disabled for Authority-First shadow execution. |
| Production / institutional mutation | Not authorized by this program. |

The repository contains untracked historical artifacts and local working material. They are preserved and are not treated as current certification evidence unless referenced by a sealed record.

## Workstream status

| Workstream | Status | Current authorized action |
|---|---|---|
| A — Factory reliability | Active | Preserve Authority-First and repair only general verified defects. |
| B — Autonomous operations | Active, highest priority | Implement TL-AUTONOMY-001 outcome, deferment, bounded re-entry, and immutable lineage contracts. |
| C — Institutional integration | Implemented baseline; verification ongoing | Keep Factory → Governance → Library → Published Memory boundaries intact. |
| D — Founder/Admin | Partially implemented | Extend existing authenticated operations UI only through server-owned, audited controls. |
| E — Public experience | Implemented baseline; verification ongoing | Complete bounded accessibility, responsive, and reliability defects as evidenced. |
| F — Infrastructure and security | Active | Run non-destructive verification and remediate proved defects. |
| G — Existing monetization | Deferred | No activation or external commercial integration authorized. |
| H — Certification | Blocked for Phase 2; local verification active | Preserve sealed evidence; do not claim certification without the locked 4/4 evidence. |

## Current implementation increment

**Increment:** `TL-AUTONOMY-001` additive Factory V2 operational-outcome contract.

**Scope:** versioned terminal outcomes; preservation of existing detailed terminal classifications; immutable evidence basis and attempt lineage; deferred-topic eligibility; bounded re-entry evaluation; deterministic unit coverage.

**Non-scope:** Registry content, Community Identities, providers, budgets, retrieval permissions, historical thresholds, Governance/Library ownership, production configuration, discovery/publication/Governance-submission activation, Phase-2 benchmark, and deployment.

**Implementation state:** Completed locally on `2026-10-16`. Factory V2 now persists an additive, policy-versioned autonomous outcome on both the mutable shadow topic-operation projection and the immutable failure record. A protected governed-capacity exhaustion becomes a deferred `PUBLIC_EVIDENCE_LIMITATION` only with the explicit `GOVERNED_CAPACITY_EXHAUSTED` basis; provider failure, budget/deadline exhaustion, implementation failure, and valid completed knowledge are distinct. Deferred records require either a relevant change or an explicitly authorized retry. Existing detailed terminal diagnostics remain authoritative and unchanged.

**Admin read increment:** Completed locally on `2026-10-16`. The existing authenticated `factory_operator` Admin surface now reads a bounded deferred-topic projection through a server-owned, HMAC-authenticated Functions bridge. The projection carries only operation lineage and the recorded autonomous outcome; it is read-only, fails closed on an invalid signature, and filters malformed persisted records. It deliberately does not expose a re-entry control because release-pinned re-entry requires a separate immutable request and caller contract.

**Re-entry contract increment:** Completed locally on `2026-10-16`. Factory V2 now defines an immutable deferred re-entry request with the originating failure and operation lineage, exact original release identity, a new run identity, and exactly one generation advance. Public-evidence limitations require a governed relevant-change artifact; budget exhaustion requires a separately attributable authorization and immutable reason. Its repository-only consumer reads request, operation, failure, receipt, and next-run identity in one transaction, then atomically creates an immutable consumption receipt and a queued next-generation operation. It is idempotent only for the matching prior receipt and rejects stale or occupied lineage.

**Server-owned request-creation increment:** Completed locally on `2026-10-16`. The new repository transaction derives every re-entry lineage field from the persisted deferred operation and immutable failure record; the caller cannot supply a run, generation, release, outcome, or failure identity. For public-evidence limitations it accepts only a post-terminal, open, complete, immutable `NEWLY_RETRIEVED` or `REVALIDATED` source snapshot whose current source document is attributable to a publisher. For budget exhaustion it requires an authenticated Factory operator identity and bounded authorization reason. A signed internal Functions endpoint and CSRF/RBAC-protected `factory_operator` Admin route carry only the permitted trigger inputs. No route mutates evidence, the Registry, Governance, Historical Library, or Published Memory.

**Operational-feasibility increment:** Completed locally on `2026-10-16`. The deferred Admin read model now derives a bounded, read-only re-entry feasibility signal from the exact deferred operation and immutable terminal failure record: required condition, terminal time, consumed attempts and budget, and detailed failure class. It has no historical-significance, priority, coverage, selection, evidence, Registry, Governance, or publication field; it cannot reorder or modify any research work. The Admin surface presents it solely as an operational condition.

**Governed source-submission increment:** Completed locally on `2026-10-16`. A `factory_operator` can submit a credential-free HTTPS URL and rationale only for a matching `PUBLIC_EVIDENCE_LIMITATION` deferred operation. The server derives submitter identity and terminal lineage, then preserves an immutable `CANDIDATE` record with `sourceSnapshotId: null`; candidates are listed read-only with their provenance. They cannot be used as evidence or re-entry changes until a separate V2 Factory validation/retrieval flow creates and validates a source snapshot under the normal Authority-First rules.

**Candidate authority-resolution increment:** Completed locally on `2026-10-16`. Before a candidate may be retrieved, the repository now resolves its original deferred operation, immutable terminal failure, retained `topicAuthoritySetId`, validated Topic Authority Set, and bound registered publisher version. The submitted HTTPS domain must match that exact bound publisher; no network access occurs in this step and any missing or mismatched lineage fails closed.

**Candidate retrieval-handoff increment:** Completed locally on `2026-10-16`. A worker-only V2 handoff now seals an `AUTHORITY_ELIGIBLE` validation observation before invoking the existing bounded SSRF, DNS, redirect, robots, access, body-size, and archive controls. It seals a separate retrieval observation with candidate, validation, authority, source, and snapshot lineage. A fetched item is always `qualifyingEvidence: false` and `reentryAuthorized: false`; inaccessible, empty, access-limited, or authority-escaping redirect material is explicitly rejected. There is no Admin or public retrieval endpoint, no claim creation, and no Registry, Governance, Library, or Published Memory mutation.

**Retrieval persistence isolation correction:** Completed locally on `2026-10-16`. A durable-write failure in the worker handoff now propagates as an infrastructure failure; it can no longer be caught and reclassified as a source-material rejection. This preserves the doctrine’s separation between implementation/infrastructure faults and public-evidence limitations.

**Bounded retrieval-dispatch increment:** Completed locally on `2026-10-16`. The Factory exposes a strict internal-only candidate retrieval dispatch contract with a sealed candidate identity and execution timestamp. It is not an HTTP payload, Admin control, queue configuration, or deployed worker; therefore it cannot activate autonomous discovery. Its timestamp is bound into immutable execution identity, and no unused caller-provided dispatch identity remains.

**Dispatch testability increment:** Completed locally on `2026-10-16`. The internal dispatcher accepts injected retrieval dependencies only as an in-process function argument, allowing deterministic worker-path tests without creating a network endpoint, queue, or alternate caller-controlled acquisition path.

**Dispatch execution-path verification increment:** Completed locally on `2026-10-16`. A real internal dispatch invocation now proves that only a sealed candidate identity and timestamp reach the worker: a registered publisher, immutable authority validation, and injected retrieval failure produce a persisted `RETRIEVAL_REJECTED` observation which remains explicitly non-evidentiary. The strict contract rejects widened caller acquisition fields. This test introduces no HTTP route, queue, Admin control, or discovery activation.

**Controlled dispatch retrieval verification increment:** Completed locally on `2026-10-16`. The same internal-only worker path now retrieves fixture material through public-DNS and robots controls from a registered authority, persists its source, immutable snapshot, and extracted segments, and records `RETRIEVED_UNQUALIFIED`. Even a successful authority-bound retrieval remains `qualifyingEvidence: false` and `reentryAuthorized: false`; it cannot create evidence, reopen an operation, or activate discovery.

**Dispatch persistence-failure verification increment:** Completed locally on `2026-10-16`. The internal dispatcher now has direct regression coverage proving that a durable retrieval-observation write failure propagates unchanged as an infrastructure error, even when source retrieval itself fails. It cannot be relabeled as a public-evidence limitation or silently converted into an ordinary rejected observation.

**Firestore dispatch-lineage verification increment:** Completed locally on `2026-10-16`. The isolated Firestore emulator now exercises the exact strict internal dispatcher against persisted registered-publisher, Topic Authority Set, terminal-operation, and candidate lineage. It proves the resulting registered-authority retrieval is durably stored as `RETRIEVED_UNQUALIFIED`, non-evidentiary, and unauthorized for re-entry, while still passing DNS and robots controls. The dispatcher remains worker-only and unactivated.

**Deferred-re-entry activation-boundary verification increment:** Completed locally on `2026-10-16`. Contract coverage now proves the atomic consumer remains transaction-owned and that neither a public API nor the server backend client exposes a consume/dispatch route for deferred re-entry or a dispatch/retrieve route for submitted sources. The only enabled internal mutations create bounded requests and candidates; consumption and retrieval dispatch remain deliberately unactivated.

**Governed retrieval-lineage verification increment:** Completed locally on `2026-10-16`. The Firestore emulator now persists a registered publisher authority version, validated Topic Authority Set, deferred terminal operation, and governed submitted-source candidate, then proves that authority resolution creates a strict immutable validation artifact and that a retrieval observation remains explicitly non-evidentiary. The test also exposed and corrected repository hydration so Firestore document IDs never enter strict artifact contracts.

## Certification and verification state

Local and shadow verification may be executed only within existing budgets and safety controls. No result becomes Phase-2 certification unless it is a fresh four-subject run from one materially equivalent sealed release and produces four valid CKS records. Provider-backed certification is not part of the current implementation increment.

Completed for this increment:

- Functions strict typecheck: passed.
- Focused autonomous-operation, authenticated bridge, contract, completion, and orchestration tests: 17/17 passed.
- Full Functions suite: 359 passed, 0 failed, 2 intentional emulator-only skips.
- Isolated Firestore emulator repository suite: 7 passed, 0 failed, including concurrent deferred re-entry request creation and consumption plus submitted-source authority/retrieval lineage.
- Root suite: 249 passed, 0 failed; root strict typecheck and lint passed, revalidated after the deferred re-entry activation-boundary increment.
- Tier-1 security gate: passed with zero high/critical production findings; the existing build-tooling-only advisory remains explicitly accepted under its recorded constraints.
- Functions build and Next optimized production build: passed.
- No provider call, certification execution, production mutation, or institutional/public write was performed.

## Founder-only boundaries

- Constitutional or LOCK changes; institutional responsibility changes.
- Registry capacity or Community Identity approval.
- New provider, material third-party dependency, or financial commitment.
- Activation of autonomous discovery, publication, Governance submission, deployment, or launch.
- Locked certification benchmark changes and legal/licensing/privacy/security exceptions.

## Next authorized action

Founder authorization sealed `.70` release `dd9737a1742a68c726aa3d41fd4549430c6d68098cf48fb13c6fd38ee6f7ed16` and ran exactly one fresh, non-combined certification. San Francisco produced a valid CKS with exact parity; Berlin failed closed before research/retrieval on `UNRESOLVED_AFFECTED_COMMUNITY_IDENTITY` for a locked affected-community requirement, also with exact parity. Ada and Printing Press were not executed. The next action is Founder-reserved historical governance: authorize a bounded, evidenced Community Identity/Registry resolution or another compliant disposition. Do not retry certification, alter standards, activate re-entry/discovery/publication/Governance submission, deploy, or infer a Registry change.
