# TL-EVIDENCE-FIRST-GENERATION-001 — Pass A Integration Plan

Date: 2026-09-09

Status: **IMPLEMENTATION AUTHORIZED; SHADOW_CERTIFICATION NOT YET ESTABLISHED**

Editorial Excellence: **NOT_CERTIFIED**

Autonomous discovery: **PAUSED**

## 1. Decision and boundary

Implement Strategy C: selectively adapt the Factory V2 evidence-first knowledge-completion and comparative-selection mechanisms inside the deployed serverless generation implementation. Preserve the certified production control plane and every institutional authority boundary.

Factory V2 remains non-authoritative. Its existing SHADOW-only repository contracts are not promoted wholesale. Public intake, Topic Ledger ownership, generation leases and idempotency, priority/autonomous queues, Editorial Intelligence, Timeline Quality, final Source Authority, independent reader assessment, Governance, Historical Library, Published Memory, Projection Engine, Search, and Public Platform retain their present owners.

The first release mode is `SHADOW`. It may write only immutable non-public Production Memory and certification records. It may not create Governance packages or decisions, Historical Library admissions, Published Memory, projections, search publication, or public timelines.

## 2. Exact mechanism mapping

| Factory V2 mechanism | Production counterpart / adoption decision |
|---|---|
| Scope Contract | Adapt as the immutable first artifact of a version-pinned generation job; Topic Ledger topic identity and generation remain authoritative. |
| Research Map and bounded query plan | Adapt beneath the generation job with explicit critical questions, phases, dimensions, and budgets. |
| Reconnaissance and secure retrieval | Reuse bounded discovery, URL policy, redirect validation, size/time limits, and retrieval provenance. |
| Source snapshots and evidence segments | Reuse content-addressed immutable artifacts in server-only Production Memory. |
| Atomic claims and claim/evidence edges | Reuse strict schemas, hashes, and explicit source lineage. |
| Publisher/claim authority and conflict sets | Reuse as preselection admissibility inputs; these do not replace final Source Authority. |
| Entity and EVENT resolution | Reuse canonical identity resolution and deterministic EVENT/non-event eligibility. |
| Coverage audit and one completion round | Reuse exactly one gap-directed completion round; no whole-inventory regeneration. |
| Completed Knowledge Set | Reuse as the explicit, immutable candidate universe for selection. |
| Comparative significance | Reuse `ESSENTIAL`, `MAJOR`, `SUPPORTING`, and `EXCLUDE` judgments over every eligible candidate. |
| Deterministic selection | Adapt to select the smallest sufficient supported set, not a schema floor; maximum remains 20. |
| Timeline View Specification / membership | Adapt into an immutable Event Lock containing selected event, date, claim, and evidence identities. |
| V3 plan/generation | Retire from the new path as the historical-inventory author. Composition becomes a constrained writer over Event Lock. |
| V3 Timeline Quality, reader, Governance handoff | Preserve as independent downstream gates with a narrow adapter from Event Lock composition. |

## 3. Production artifact chain

```text
TopicLedger generation + generation release identity
  -> ScopeContract
  -> ResearchMap
  -> QueryPlan / acquisition records
  -> SourceDocument + immutable SourceSnapshot
  -> EvidenceSegment
  -> AtomicClaimVersion + ClaimEvidenceEdge
  -> ClaimAuthorityVerdict + ClaimConflictSet
  -> CanonicalEntityVersion
  -> CanonicalEventVersion
  -> initial KnowledgeCoverageAudit
  -> bounded KnowledgeCompletionPlan
  -> final KnowledgeCoverageAudit
  -> CompletedKnowledgeSet
  -> ComparativeSignificanceAssessment
  -> DeterministicSelection
  -> EventLock
  -> ConstrainedComposition
  -> TimelineQualityAssessment
  -> final SourceAuthorityAssessment
  -> ReaderEditorialAssessment
  -> Governance package (disabled in SHADOW)
```

Every immutable artifact contains its corpus, topic, generation, schema/policy/prompt/release versions, parent IDs, parent hashes where required, canonical payload hash, and immutable marker. Content-addressed identities must be stable under canonical serialization. A consumer rejects a missing parent, hash mismatch, cross-corpus/topic/generation reference, version mismatch, non-canonical membership, stale generation, or changed Event Lock.

## 4. Topic Ledger and release identity

The Topic Ledger continues to own normalized topic identity, active job, generation, state, lease, attempts, and terminal outcome. New tasks carry IDs and a pinned `generationReleaseId`; workers resolve the immutable release manifest and reject a payload whose release identity does not match their locally built capability manifest.

The release manifest binds:

- source revision;
- root and Functions dependency-lock hashes;
- configuration-bundle hash;
- generation pipeline capability;
- prompt and policy versions;
- schema versions;
- Timeline Quality, Source Authority, and reader capabilities.

Priority and autonomous worker exports must expose the same manifest. Preflight refuses production readiness on a mismatch. Postflight verifies deployed revision/source identity and runtime manifest parity. SHADOW certification does not authorize deployment.

Both existing generation worker exports share one routing implementation. An evidence-first invocation is admitted only when its strict task payload carries the exact deployed generation release ID and runtime mode is `SHADOW`; malformed or stale release-bearing payloads cannot fall back to V3. The worker reuses the existing Topic Ledger lease, active-job, generation, retry, and idempotent task identity boundaries. Current intake deliberately emits only legacy V3 payloads until a separately authorized post-shadow cutover.

## 5. Bounded budgets

Per subject:

- at most 7 grounded discovery calls;
- at most 40 provider queries;
- at most 60 source documents;
- at most 300 atomic claims;
- at most 200 canonical EVENT candidates;
- exactly one gap-directed knowledge-completion round;
- at most 2 semantic repair attempts within the owning stage;
- at most 3 transport attempts per provider call;
- at most 3 concurrent retrieval/provider operations;
- at most 1,200 worker seconds;
- at most 20 selected milestones;
- no minimum milestone target imposed on research or selection.

If a faithful timeline cannot be produced inside these bounds or the supported product bounds, the job fails closed with an explicit terminal reason.

## 6. Failure states and retry ownership

| Failure class | Owner and permitted response |
|---|---|
| Invalid or expanded scope | Scope stage; reject. Scope never silently reopens. |
| Discovery/retrieval insufficiency | Evidence stage; bounded transport retry, then the single gap-completion round, then fail closed. |
| Unsupported/duplicate claim | Claim stage; resolve against acquired evidence or exclude. No invented claim. |
| Material claim conflict | Authority/conflict stage; resolve with bounded evidence or fail closed. |
| Non-event/duplicate event | Event-resolution stage; exclude or canonicalize; never convert context into an event. |
| Coverage deficiency | Knowledge-completion stage; one bounded gap round, then fail closed. |
| Selection deficiency | Selection stage; recompute only from the same Completed Knowledge Set. Missing history returns to no earlier stage after completion is sealed. |
| Composition defect | Composition stage; bounded wording rewrite from the same Event Lock. |
| Timeline Quality prose defect | Composition stage; bounded prose repair only. |
| Timeline Quality historical defect | Terminal fail closed. Writer cannot add history. |
| Final Source Authority failure | Terminal fail closed unless an existing explicit policy can add evidence without altering locked membership or claims. |
| Reader failure | Existing bounded reader policy, then fail closed. |
| Provider/system transient | Owning stage performs bounded retry without repeating completed content-addressed stages. |
| Stale lease/generation/release | Acknowledge without work; Topic Ledger remains owner. |

Retries resume at the failed stage using verified parent IDs and hashes. They never regenerate a sealed upstream artifact merely to obtain a different answer.

## 7. Event Lock and composition contract

Event Lock is the immutable boundary between knowledge/selection and prose. It contains ordered event-version IDs, exact temporal objects, core/supporting claim-version IDs, evidence/source references, selection rationale, and all parent hashes.

Composition may change only reader-facing wording. Deterministic verification requires exact event membership, ordering, historical dates, claim references, and evidence references. Any added or removed milestone, changed date, scope expansion, unsupported statement, or altered lock reference fails closed.

## 8. Rollback

Before public authorization, rollback is configuration-only: keep the evidence-first capability in `SHADOW` or set its kill switch. Existing public V3 intake behavior is not changed by the shadow implementation. Immutable shadow artifacts are preserved as audit evidence and are never rewritten or promoted.

A later separately authorized production cutover must bind both generation workers atomically to one release manifest. Rollback changes the accepted release for new generations only; it must not mutate in-flight or completed lineage.

## 9. Deployment parity acceptance

A generation release is not production-ready unless all of the following match for priority and autonomous workers: release ID, source revision, dependency hashes, configuration hash, prompt/policy/schema bundle, generation capability, reader capability, and exported runtime manifest. Preflight and postflight must fail closed and emit structured diagnostics for every mismatch. Operator memory is not a control.

## 10. Certification boundary

Repository-green means `IMPLEMENTED`, not `SHADOW_CERTIFIED`. Before the 30-subject run, the shadow corpus and numerical certification thresholds must be frozen in repository records. `SHADOW_CERTIFIED` requires those predeclared thresholds, human-style inspection, zero authority-boundary violations, zero lineage corruption, zero public/institutional writes, zero parity defects, and no known systematic provider defect.

If the shadow run fails, stop and report `NOT_SHADOW_CERTIFIED`. Do not lower thresholds or begin live certification. Editorial Excellence remains `NOT_CERTIFIED` until a later, separately authorized public certification succeeds.
