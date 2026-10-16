# TL-SUPERGOAL-001 — Autonomous Tier-1 Production Completion

**Status:** ACTIVE — INDEPENDENT CTO ENGINEERING EXECUTION
**Authority:** CTO execution index; subordinate to `Knowledge/AUTHORITY_INDEX.md`, the V2 canons, locked institutional records, and certification artifacts.
**Last reconciled:** 2026-10-16
**Related records:** `docs/programs/TL-TIER1-COMPLETION-001.md`; `docs/decisions/TL-AUTONOMY-001.md`.

## Purpose and control boundary

This is the durable execution index for the authorized Tier-1 completion program. It records current repository evidence and implementation progress; it neither supersedes constitutional/LOCK authority nor authorizes production deployment, launch, Registry expansion, new providers, or a change to the locked Phase-2 benchmark.

## Reconciled repository state

| Item | Current evidence |
|---|---|
| Prior program checkpoint | `b1ba6e2` — `docs: record terminal alert regression` (following `2994fe4` terminal-enqueue observability) |
| Baseline implementation checkpoint | `24d4507a4e67718bc4363f409ce2973ad4e298d9` (`factory-v2-a.70`, Authority-First `.43`, schema `.15`, prompt `.21`) |
| Latest sealed Phase-2 evidence | `.70` release `dd9737a1742a68c726aa3d41fd4549430c6d68098cf48fb13c6fd38ee6f7ed16`; its fresh non-combined run produced one valid San Francisco CKS before Berlin failed closed on the protected affected-community identity boundary. |
| Phase 2 | **BLOCKED — FOUNDER-GOVERNED HISTORICAL IDENTITY/CAPACITY; UNCERTIFIED.** The locked four prescribed subjects / one materially equivalent sealed release / four valid CKS criterion is unchanged. |
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
| H — Certification | **Blocked — Founder-governed historical identity/capacity** | Preserve `.70` sealed evidence; do not infer a Community Identity, expand Registry capacity, or rerun certification without separately justified authorization. This does not block independent engineering. |

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

**Nonblocking generation-retry increment:** Completed locally on `2026-10-16`. The bounded legacy generation retry drain now isolates each Cloud Tasks enqueue failure. A failed or malformed ready entry remains `RETRY_SCHEDULED` with a bounded next-attempt time and structured diagnostic, while later ready entries continue. On a successful enqueue, the ledger and its generation-job projection advance together to `QUEUED`. This applies only to existing generation queue recovery; it neither consumes deferred V2 re-entry requests nor activates discovery, retrieval dispatch, publication, Governance submission, deployment, or any historical workflow.

**Generation-retry operational visibility increment:** Completed locally on `2026-10-16`. The authenticated `factory_operator` interface now has a bounded, read-only view of retry-scheduled generation work through the existing signed server bridge. It exposes only topic/job lineage, origin, generation, retry time, update time, and a boolean diagnostic-presence signal; raw failure text stays server-side. The interface supplies no retry, dispatch, reprioritization, re-entry, discovery, or publication control.

**Generation-retry attempt visibility increment:** Completed locally on `2026-10-16`. The same bounded read model and Admin interface now expose the persisted enqueue-delivery retry count. The value is derived server-side from the retry-scheduled ledger document, rejects invalid values to zero, and is covered by the Firestore retry regression. It remains diagnostic-only: the interface exposes neither the retry ceiling nor a control that can modify, dispatch, reprioritize, consume re-entry, or alter protected historical state.

**Terminal enqueue-failure visibility increment:** Completed locally on `2026-10-16`. A separate, indexed, bounded read model now exposes only terminal legacy delivery exhaustion (`FAILED` / `enqueue_failed`) to authenticated `factory_operator` users through the signed server bridge. It derives job/topic lineage, origin, generation, terminal time, bounded retry count, and diagnostic presence from server-owned ledger state; raw failure text remains server-side. The new interface is strictly read-only and adds no dispatch, retry, reprioritization, deferred re-entry, discovery, publication, Governance, Registry, or historical-state control.

**Terminal enqueue-failure integrity increment:** Completed locally on `2026-10-16`. The read model now admits a terminal enqueue failure only when its persisted retry count exactly equals the configured terminal ceiling. Invalid counts cannot masquerade as an authoritative operational exhaustion; the Firestore emulator proves a malformed count is excluded while a genuine fifth-attempt terminal record remains visible.

**Terminal enqueue-failure query isolation increment:** Completed locally on `2026-10-16`. The exact terminal-count invariant now belongs to the indexed Firestore query rather than only post-query filtering. Corrupt terminal documents therefore cannot consume the bounded result window and hide valid operational failures; the compound index preserves the ordered bounded read.

**Terminal enqueue-observability increment:** Completed locally on `2026-10-16`. Once terminal delivery exhaustion is durably persisted, the scheduler now emits exactly one structured `ERROR` event with action, topic/job lineage, bounded retry count, and diagnostic-presence signal. It deliberately omits raw failure text from the terminal alert event. Transient retry failures remain `WARNING` events, so alerting distinguishes actionable terminal exhaustion from scheduler-owned recovery without creating a new control plane.

**Retry-batch telemetry increment:** Completed locally on `2026-10-16`. Every completed bounded scheduler drain now emits one structured `INFO` event with its enforced request limit, requeued count, and elapsed duration. The telemetry is emitted by the existing scheduler-owned path only, contains no source/evidence or raw diagnostic content, and adds no retry control, dispatch, discovery, re-entry, publication, Governance, Registry, or protected-state mutation.

**Retry-batch terminal-outcome telemetry increment:** Completed locally on `2026-10-16`. The same completion event now includes the number of terminal enqueue exhaustions persisted in that bounded batch. It cleanly distinguishes successful queue recovery throughput from operationally actionable exhaustion while retaining the separate sanitized terminal error event and no control-plane capability.

**Bounded enqueue-recovery increment:** Completed locally on `2026-10-16`. Persistent Cloud Tasks delivery failures now consume a separate, capped enqueue-retry counter and terminate the affected legacy generation item after five retry deliveries rather than looping indefinitely. The retry ceiling is operational only; it does not create or consume a V2 deferred re-entry request, alter historical evidence, or activate any production path.

The Firestore emulator regression verifies both nonblocking recovery of a later ready topic and the fifth failed delivery’s terminal `FAILED` ledger/job state with no future retry time.

Terminal enqueue exhaustion also creates a durable non-retryable failure record with the job, bounded attempt count, and preserved diagnostic.

**Public-search accessibility increment:** Completed locally on `2026-10-16`. The public search page now trims whitespace before invoking the server-owned bounded search service and presents a semantic, polite live-region empty-result state with useful reader guidance. It does not alter ranking, result contracts, persistence, Factory access, or publication behavior.

**Public-search input-bound increment:** Completed locally on `2026-10-16`. Public search now applies the API-compatible 120-character query cap in both its browser form and server-rendered route, so direct oversized URLs cannot inflate metadata or downstream search work. Search semantics remain server-owned and the existing result cap is unchanged.

**Public-search navigation increment:** Completed locally on `2026-10-16`. Public search now pages projection-backed results in bounded groups of 20, with a maximum requested page of 500 and accessible previous/next navigation. Query identity, result ranking, and backend limits remain server-owned; no Factory or institutional data enters the reader path.

**Public-search page identity increment:** Completed locally on `2026-10-16`. Each bounded public-search page now emits its own canonical and Open Graph URL, preserving pagination identity for readers and crawlers without broadening result access or changing public content.

**Public-search page normalization increment:** Completed locally on `2026-10-16`. The server-rendered search route now accepts only canonical positive-integer page parameters before applying its existing 500-page cap. Malformed, signed, decimal, whitespace-padded, or mixed-text values fail closed to the first page rather than being partially parsed into later result offsets. Query ranking, result bounds, content access, and public-data separation are unchanged.

**Public-search deep-page correction increment:** Completed locally on `2026-10-16`. The projection repository now retains the server-reported result total even when a bounded requested page contains no rows. The reader route uses that total to redirect an in-range-but-out-of-range page request to the final actual page, preventing misleading empty pages and invalid page-count text. Search remains projection-backed, bounded, and server-owned; no Factory or institutional data enters the public path.

**Public-search direct-request bound increment:** Completed locally on `2026-10-16`. The serverless public search API now rejects a trimmed query longer than 120 characters before Unicode normalization or tokenization. This aligns direct API traffic with the existing browser and reader-route cap, preserving bounded CPU work and stable result contracts without changing ranking, projections, or public-content access.

**Public-topic-status direct-request bound increment:** Completed locally on `2026-10-16`. The serverless public topic-status API now trims and requires a nonempty query of at most 120 characters before topic normalization and ledger lookup. This aligns status lookups with timeline-request identity bounds and prevents unbounded direct input from reaching the hashing or database path; it does not alter state visibility or generation behavior.

**Production-readiness configuration verification:** Revalidated locally on `2026-10-16` after the operational-interface change. The non-destructive production-hardening validator passed dashboard, alert-delivery, PITR/recovery, retention, deployment-workflow, and incident-severity configuration checks; the monitoring validator passed all metric-to-alert mappings. This is configuration readiness evidence only and does not authorize deployment, launch, publication, or any protected-state mutation.

## Phase-2 certification boundary

The `.70` sealed release and immutable report are preserved. The fresh prescribed certification run established one valid Completed Knowledge Set for **The 1906 San Francisco Earthquake** with exact protected-state parity. **The Berlin Blockade and Airlift** then failed closed before research or retrieval on `UNRESOLVED_AFFECTED_COMMUNITY_IDENTITY` for a locked affected-community requirement, also with exact parity. **Ada Lovelace: Life and Work** and **The Development of the Printing Press** were not executed after the failure.

Phase 2 is therefore not passed and must not be retried, combined with another release, or treated as a basis for publication. The remaining action is Founder-only: a bounded, evidenced decision on the protected Berlin affected-community identity/Registry capacity boundary or another compliant disposition. All independent technical workstreams remain active.

## Certification and verification state

Local and shadow verification may be executed only within existing budgets and safety controls. No result becomes Phase-2 certification unless it is a fresh four-subject run from one materially equivalent sealed release and produces four valid CKS records. Provider-backed certification is not part of the current implementation increment.

Completed for this increment:

- Functions strict typecheck: passed.
- Root strict typecheck: passed after the generation-retry attempt visibility increment.
- Focused Firestore emulator retry regression: passed after the generation-retry attempt visibility increment, including the persisted retry-count summary and terminal exhaustion behavior.
- Functions contract suite: 13 passed, 0 failed after the terminal enqueue-failure visibility increment.
- Focused Firestore emulator retry regression: passed after terminal enqueue-failure visibility, proving the indexed terminal failure summary reports the persisted fifth-attempt failure without exposing diagnostics.
- Focused Firestore emulator retry regression: passed after terminal enqueue observability, proving exactly one sanitized terminal `ERROR` event follows durable fifth-attempt failure while transient recovery remains a `WARNING`.
- Focused Firestore emulator retry regression: passed after retry-batch telemetry, proving one bounded completion event reports the enforced limit, throughput, and nonnegative latency.
- Functions strict typecheck, contract suite (13/13), and focused Firestore emulator retry regression: passed after terminal enqueue-failure integrity filtering.
- Functions strict typecheck and focused Firestore emulator retry regression: passed after indexed terminal-count query isolation.
- Functions strict typecheck and focused Firestore emulator retry regression: passed after terminal-outcome batch telemetry.
- Full root suite: 250 passed, 0 failed after terminal enqueue-failure visibility; expected fixture warnings remained non-failing and no production mutation occurred.
- Functions build and optimized Next production build: passed after terminal enqueue-failure visibility; the new route remains dynamically server-owned and Admin-authenticated.
- Production-hardening validator: passed all dashboard, alert, PITR, retention, deployment-workflow, and incident checks; monitoring validator passed all 27 declared metrics and 15 alerts.
- Tier-1 security gate and root lint: passed after terminal enqueue-failure visibility. Production runtime audits remain zero high/critical; the recorded lint-tooling-only advisory remains accepted solely under its existing constraints.
- Full Functions suite: 360 passed, 0 failed, 2 intentional emulator-only skips after terminal enqueue observability.
- Public-search pagination regression and root strict typecheck: passed after strict page-parameter normalization.
- Public-search deep-page regression and root strict typecheck: passed after total-preservation and final-page redirect correction.
- Full root suite: 251 passed, 0 failed after the public-search deep-page correction; expected fixture warnings remained non-failing and no production mutation occurred.
- Functions and root strict typechecks plus public API contract regression: passed after the direct-request query bound.
- Functions strict typecheck and public API contract regression: passed after the direct topic-status bound.
- Focused autonomous-operation, authenticated bridge, contract, completion, and orchestration tests: 17/17 passed.
- Full Functions suite: 360 passed, 0 failed, 2 intentional emulator-only skips.
- Isolated Firestore emulator suite: 10 passed, 0 failed, including concurrent deferred re-entry request creation and consumption, submitted-source authority/retrieval lineage, protected-state rules, full V2-A shadow orchestration, and nonblocking generation retry recovery.
- Root suite: 250 passed, 0 failed; root strict typecheck and lint passed, revalidated after the public-search accessibility increment.
- Tier-1 security gate: passed with zero high/critical production findings; the existing build-tooling-only advisory remains explicitly accepted under its recorded constraints.
- Functions build and Next optimized production build: passed.
- Production-hardening and monitoring configuration validators: passed after the generation-retry interface increment.
- No provider call, certification execution, production mutation, or institutional/public write was performed.

## Founder-only boundaries

- Constitutional or LOCK changes; institutional responsibility changes.
- Registry capacity or Community Identity approval.
- New provider, material third-party dependency, or financial commitment.
- Activation of autonomous discovery, publication, Governance submission, deployment, or launch.
- Locked certification benchmark changes and legal/licensing/privacy/security exceptions.

## Next authorized action

Continue independent Factory reliability and public-reader verification work. The next implementation target is bounded operational latency/availability evidence for the existing server-owned interfaces, with no deployment, publication, discovery, re-entry dispatch, or historical-policy change. The separate Phase-2 historical identity/capacity boundary remains Founder-governed.
