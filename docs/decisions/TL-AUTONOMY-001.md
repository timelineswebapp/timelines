# TL-AUTONOMY-001 — Autonomous Public Evidence Doctrine

**Status:** FOUNDER-APPROVED OPERATING PRINCIPLE
**Decision date:** 2026-10-16
**Related program:** `TL-TIER1-COMPLETION-001`
**Authority level:** Decision Record (subordinate to the Product Constitution, Architecture Canon, Schema Canon, locked institutional doctrine, and certification records)

## Decision

TiMELiNES' normal autonomous Factory workflow shall use only public evidence that is reachable through an authorized digital interface, retrievable by the Factory, inspectable at source and relevant-segment level, attributable, access-compliant, and eligible under the existing Authority Registry and claim-relative evidence rules.

This is an operating constraint on autonomous acquisition. It is not an authority, schema, Registry, provider, publication, or Phase-2 benchmark change. The Factory remains Authority-First and remains unable to publish; Governance and the Historical Library retain their existing decision and admission boundaries.

## Rationale

The Factory is intended to operate without routine human correspondence, private-access arrangements, or continuous Founder research. Autonomous operation is trustworthy only when its evidence can be independently retrieved and checked through authorized interfaces. Conversely, public discoverability alone is not evidence: catalog records, search snippets, inaccessible media, and restricted endpoints cannot support a historical claim.

The current locally verified implementation checkpoint is `24d4507a4e67718bc4363f409ce2973ad4e298d9` (`factory-v2-a.70`, Authority-First `.43`, schema `.15`, prompt `.21`). It is not a sealed release or Phase-2 certification. This decision creates no exception for the unresolved Berlin affected-community requirement and does not create an East Berlin identity, capacity, or approved source.

## Binding operating principles

1. Autonomous evidence eligibility requires all six properties: public authorized reachability; actual Factory retrieval; source- and segment-level inspectability; identifiable attribution; compliance with security, rights, access, robots, authentication, paywall, and licensing restrictions; and eligibility under existing Authority Registry, claim-relative authority, independence, corroboration, conflict, and final-sufficiency rules.
2. A catalog entry, result snippet, restricted recording, inaccessible transcript, or inaccessible collection is discovery metadata only. It is never acquired evidence.
3. The Factory must not bypass paywalls, authentication, robots restrictions, licenses, access controls, or other restrictions. It must fail closed and preserve the access diagnostic.
4. Public reachability does not replace Authority-First. No external discovery provider, source-permission expansion, or admission-boundary expansion is authorized.
5. Protected perspectives, governed Community Identities, affected-community requirements, party and jurisdictional representations, provenance, independence, corroboration, conflict handling, and final evidence sufficiency remain mandatory. An inaccessible protected perspective is never removed or substituted merely because it is difficult to retrieve.
6. Factory Production Memory remains distinct from Published Memory. The only publication path remains Factory proposal, Governance decision, Historical Library admission, then projection and platform presentation.

## Scope and exclusions

In scope are the autonomous public-evidence rule, its future outcome/deferment semantics, the bounded Admin/Governance integrations needed to operate it, and its certification interpretation.

Out of scope are architecture redesign, weakened evidence standards, production deployment, new providers, Registry expansion, Community Identity creation, discovery activation, publication activation, Governance submission activation, changes to the four-subject Phase-2 criterion, and any reclassification of the current `.70` checkpoint as certified.

## Public-evidence and historical-integrity safeguards

Existing V2 retrieval already provides the correct baseline: HTTPS-only and SSRF-safe retrieval, redirect bounds, robots enforcement, access-limited/unavailable source states, safe extraction, immutable snapshots, and no cache reuse of unavailable or access-limited sources. Existing Authority-First contracts already fail closed on unmet protected representation and governed capacity.

Future implementation must retain those properties and add no inference that a source *about* a protected community is community-origin evidence. A failed access attempt is retained as negative operational evidence; it cannot satisfy a claim burden, eliminate a research obligation, or authorize partial publication.

The current governed boundary is unchanged: `Citizens of Berlin` does not inherit the bounded `Citizens of West Berlin` identity or capacity. The unverified Zeitzeugenportal item is not Registry capacity. No `AFFECTED_COMMUNITY` requirement may be weakened, merged, or silently omitted under this decision.

## Autonomous outcome model

The following top-level operational outcome classes are required for a future approved implementation:

| Outcome class | Required meaning | Relationship to existing diagnostics |
|---|---|---|
| `IMPLEMENTATION_FAILURE` | Deterministic contract, storage, integrity, or software failure prevents a trustworthy result. | Preserve the exact existing terminal reason, stage, artifact IDs, and immutable diagnostic. |
| `PROVIDER_INFRASTRUCTURE_FAILURE` | Provider, transport, task, network, or storage infrastructure fails under the bounded retry policy. | Preserve provider classification, attempts, backoff, and checkpoint lineage; do not relabel historically inadequate evidence as infrastructure failure. |
| `RESEARCH_BUDGET_EXHAUSTED` | The approved bounded research/completion budget ended before a stronger conclusion about availability is justified. | Preserve question set, budget ledger, discovery/retrieval attempts, and unresolved obligations. |
| `PUBLIC_EVIDENCE_LIMITATION` | The bounded, policy-compliant evidence process establishes that eligible public evidence required for completion is unavailable or non-inspectable for the necessary obligation. | Additive summary only; retain precise source, access, authority, capacity, and coverage reasons. It cannot follow from one URL or one failed attempt. |
| `VALID_COMPLETED_KNOWLEDGE_SET` | A Completed Knowledge Set satisfies every existing locked gate and remains eligible for the normal institutional path. | Does not itself publish knowledge or bypass Governance/Library admission. |

These classes are additive, mutually exclusive terminal summaries for the autonomous run; they do not replace the current failure taxonomy. Any unclassified condition continues to fail closed with its immutable diagnostic. `PUBLIC_EVIDENCE_LIMITATION` requires a policy-defined, bounded evidentiary basis across the relevant obligation (including alternative eligible candidates where the approved plan permits them). If that basis is not met, the result remains the more precise insufficient-evidence or budget-exhaustion state.

## Topic deferment and recovery

A topic that ends in `PUBLIC_EVIDENCE_LIMITATION` is deferred, not rejected, completed, published, or an implementation/provider failure. Its immutable scope, research map, questions, source/discovery/retrieval lineage, access outcomes, authority verdicts, protected requirements, budget consumption, and terminal rationale must remain reconstructable.

Deferred work must release its execution lease and must not block unrelated eligible topics. Automatic re-entry is allowed only through an approved bounded retry policy and a recorded relevant change in circumstances (for example, a newly accessible, eligible source or an approved policy/version change). It must not reconsume provider capacity against unchanged limitation evidence. Manual re-entry remains a governed action with an audit record and never turns a human assertion into qualifying evidence.

## Optional human and Admin intervention

Founder research or acquired material may enter only through governed Founder/Admin workflows with provenance, authorization, attribution, versioning, auditability, source/claim validation, and the existing approval and admission chain. Founder approval permits the workflow; it does not convert unsupported material into evidence.

Repository evidence shows existing authenticated Factory operations, Founder inbox actions, Governance decisions/approvals/queues/disputes, Historical Authority object/participation actions, source-authority services, and immutable institutional handoffs. Those components should be extended rather than replaced. The smallest future additions are:

1. a source-submission intake that creates a provenance-bearing candidate, never direct evidence or Registry admission;
2. a deferred-topic view and action that exposes terminal class, exact blocking obligation, attempt/budget lineage, and permitted re-entry trigger;
3. governed proposal workflows for Community Identity and Registry capacity, explicitly separate from evidence admission;
4. read-only provenance and access-outcome inspection linked to the existing source, failure, topic-history, Governance, and audit artifacts; and
5. role-checked approval/rejection/reprocessing actions that require an immutable reason and enforce the bounded retry policy.

No Admin interface is authorized to mutate Published Memory, bypass a Factory evidence verdict, or introduce a direct Registry capacity.

## Governance and architectural compatibility

This doctrine is compatible with the Product Constitution's chronology-first and institutional-separation rules; the Architecture and Schema Canons' server-owned, immutable candidate/admission lifecycle; the Execution Canon's validated, bounded, observable failure behavior; and the locked Factory-to-Governance-to-Library-to-Published-Memory flow.

It is also compatible with the locked Factory V2 acquisition plan, which already requires access/robots/license decisions and marks paywalled or unavailable sources without bypassing them, and with the V2 failure model, which already separates provider, historical, editorial, and authority/evidence failures. The doctrine refines the autonomous *terminal summary and deferment policy*; it does not move factual authority, admission authority, or publication eligibility.

No constitutional or LOCK document amendment is required for this decision record. A future implementation that changes a locked contract must obtain the separately required founder authorization and make a narrowly justified authority amendment; this record is not that authorization.

## Phase 0–8 roadmap impact

| Phase | Existing certified/implemented capability | TL-AUTONOMY-001 requirement | Dependency | Required verification | Exit criteria change requires founder approval |
|---|---|---|---|---|---|
| 0 — authority reconciliation | `TL-KNOWLEDGE-FACTORY-V2-AUTHORITY-001` certified the candidate/admission and view-lineage boundaries. | Register this decision as subordinate operating policy; no canon rewrite. | Authority hierarchy and this record. | Authority-reference and non-scope review. | Yes |
| 1 — primitives/isolation | Typed Factory contracts, immutable envelopes, repository boundary, operations records, and shadow isolation exist. | Add versioned, additive outcome/deferment and re-entry contracts only when authorized. | Locked schema/migration discipline and no public/institutional writes. | Schema compatibility, immutable lineage, emulator/repository tests, isolation proof. | Yes |
| 2 — acquisition | Public HTTPS retrieval, redirect/SSRF checks, robots handling, paywall/access-limited states, bounded retrieval, and Authority-First acquisition exist. | Make the six eligibility properties explicit at terminal aggregation; do not add a provider or bypass access. | Existing retrieval and Authority Registry. | Access/robots/paywall/catalog/snippet fixtures; no unauthorized network path; bounded-attempt proof. | Yes |
| 3 — claims/Source Authority | Claim-relative authority, evidence segments, source states, and conflict/evidence gates exist. | Prevent inaccessible metadata from becoming claim evidence; preserve precise reason below the top-level outcome. | Phase 2 snapshots and existing authority verdicts. | Negative-evidence, attribution, independence, protected-perspective, and final-sufficiency fixtures. | Yes |
| 4 — resolution/reuse | Governed identity resolution and bounded Community Identity/capacity checks exist. | Preserve unresolved and unavailable protected obligations through deferment; no availability-based identity inference. | Existing Community Identity and Registry controls. | Exact-alias/qualifier/capacity regressions, including Berlin non-inheritance. | Yes |
| 5 — selection | Bounded priority, scope, coverage, and selection mechanisms exist. | Add a separate public-evidence feasibility signal for operational ordering; never score historical significance down because retrieval is hard. | Evidence availability observations from phases 2–4. | Demonstrate feasibility is non-authoritative and cannot delete, demote, or alter historical requirements. | Yes |
| 6 — targeted completion | Bounded completion/research budgets and substitutions are specified/implemented. | Emit `RESEARCH_BUDGET_EXHAUSTED` when availability is not established; emit `PUBLIC_EVIDENCE_LIMITATION` only after the required bounded basis. | Approved budget and exact obligation lineage. | One-URL insufficiency, unchanged-evidence no-loop, alternate-candidate, and budget-bound fixtures. | Yes |
| 7 — locked event skeleton | Immutable locks preserve exact policy, evidence, coverage, and lineage. | Include the outcome/deferment policy/version and terminal evidence basis in the lock/terminal lineage where applicable. | Passing upstream evidence or preserved deferred terminal record. | Hash/replay and no-partial-publication tests. | Yes |
| 8 — constrained writer/prose check | Writer is constrained to locked claims and rejects unsupported assertions. | A deferred or incomplete topic must never invoke publication-quality prose as a substitute for missing evidence. | Verified lock and existing writer guards. | No-writer-on-deferred/incomplete fixture; unchanged prose-gate regressions. | Yes |

## Phase-2 certification interpretation

The locked criterion—four subjects, one materially equivalent sealed release, and four valid Completed Knowledge Sets—remains unchanged and is appropriate as a **strict historical research capability benchmark**. It demonstrates that a sealed Factory version can complete the required evidence and protected-state gates for all prescribed subjects.

It is not, by itself, a complete **autonomous operational resilience benchmark**: successful outcomes alone do not prove correct deferment, public-evidence limitation classification, bounded re-entry, or nonblocking behavior during access-limited cases. Therefore it is not currently a complete **combined certification** either.

A future, additive separation into `RESEARCH_INTEGRITY_CERTIFICATION` and `AUTONOMOUS_PUBLICATION_CAPABILITY_CERTIFICATION` would make those distinct claims auditable: the first would retain the existing four-subject sealed-valid-CKS standard; the second would test access limits, bounded failure classification, deferment, recovery, protected-obligation preservation, and institutional non-bypass. This is an evaluation only. It neither changes the current benchmark nor selects subjects, lowers standards, certifies Phase 2, or authorizes a certification run. Any benchmark, subject, exit-criterion, or certification-governance change requires founder approval.

## Implementation assessment

| Classification | Repository-grounded assessment |
|---|---|
| **ALREADY** | Authority-First policy; public HTTPS/SSRF-safe retrieval; redirect, robots, access-limit, and paywall handling; immutable source snapshots and failure diagnostics; bounded provider/research controls; protected perspective and Community Identity/capacity fail-closed checks; authenticated Factory/Governance/Admin routes; audit and institutional handoff boundaries. |
| **PARTIALLY** | Existing failure categories distinguish provider, historical, editorial, and authority/evidence causes, and Factory operations supports retry/pause/resume/replay. They do not yet expose the required additive top-level outcome classes, durable deferred state, relevant-change gate, or public-evidence feasibility view. Existing Admin/Governance surfaces can host—but do not prove—source-submission and Registry-proposal workflows. |
| **MISSING** | Versioned terminal outcome/deferment contract; evidentiary threshold for `PUBLIC_EVIDENCE_LIMITATION`; deferred-topic state/read model and bounded re-entry reason; feasibility signal separate from historical significance; governed evidence-submission integration; Community Identity/Registry-capacity proposal integration; explicit certification fixtures for the doctrine. |
| **DO NOT CHANGE** | Authority-First provider model and external discovery-provider set; Registry and Community Identity boundaries; `.70` versions and local-only status; the unverified East Berlin item; protected requirements; Factory/Governance/Library/Published Memory ownership; active discovery/publication/Governance-submission restrictions; and the current Phase-2 criterion. |

## Implementation and certification implications

No implementation, release, provider call, certification, production mutation, or LOCK/canonical-document change is authorized by this record. If later authorized, work must be a bounded, versioned policy/contract change with strict schemas, immutable records, server-side authorization, and tests listed in the roadmap matrix. It must preserve existing failure reasons and demonstrate that unsupported/publicly inaccessible evidence cannot reach a claim, CKS, Governance package, or Published Memory.

Certification must remain fail-closed. The current Phase-2 status remains uncertified; no result short of the locked four-subject sealed run can declare otherwise. A future autonomous-publication capability certification, if founded and authorized, must be additive and must prove the new failure/deferment behavior without weakening research integrity.

## Unresolved founder decisions

1. Approve or decline a future scoped implementation package for the additive outcome/deferment contracts and Admin integrations.
2. Define the policy-versioned evidentiary threshold and maximum candidate/attempt envelope for `PUBLIC_EVIDENCE_LIMITATION` without broadening research budgets.
3. Decide whether and when to establish a separate additive `AUTONOMOUS_PUBLICATION_CAPABILITY_CERTIFICATION`; any such decision must retain the locked Phase-2 benchmark.
4. Approve the exact governed roles, evidence metadata, retention policy, and review path for human source submissions and Community Identity/Registry-capacity proposals.

## Evidence reviewed

- `Knowledge/AUTHORITY_INDEX.md`; `Knowledge/01_PRODUCT_CONSTITUTION_V2.md` through `Knowledge/07_PLATFORM_STATUS_AND_ROADMAP.md`; `PROJECT_SOURCES/07_PLATFORM_STATUS.md`; and `PROJECT_SOURCES/08_MASTER_EXECUTION_ROADMAP.md`.
- `docs/architecture/WAVE_2A_LOCK.md`, `docs/architecture/WAVE_2B_GOVERNANCE_LOCK.md`, and `docs/architecture/WAVE_2B_GOVERNANCE_IMPLEMENTATION_LOCK.md`.
- `docs/constitution/HISTORICAL_OBJECT_CONSTITUTION.md`, `docs/constitution/HISTORICAL_LIBRARY_CONSTITUTION.md`, `docs/factory/FACTORY_CONSTITUTION.md`, `docs/factory/EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2.md`, and `docs/factory/EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2_ROADMAP.md`.
- `docs/certification/FOUNDATIONAL_ENGINEERING_CERTIFICATION.md`, `docs/certification/EDITORIAL_INTELLIGENCE_CERTIFICATION.md`, `docs/factory/TL-KF-V2-A2_CHRONOLOGY_COVERAGE_CERTIFICATION.md`, and `docs/programs/TL-TIER1-COMPLETION-001.md`.
- Repository contracts and services including `functions/src/factory-v2/acquisition/retrieval.ts`, `functions/src/factory-v2/authority-first.ts`, `functions/src/factory-v2/contracts/operations.ts`, `functions/src/factory-v2/orchestrator.ts`, `src/server/factory-operations/contracts.ts`, `src/server/services/factory-operations-service.ts`, and the authenticated Factory/Governance/Historical Authority route surfaces.

## Verification record

This decision record is documentation-only. No runtime, schema, configuration, Registry, source-authority, provider, discovery, certification, Governance, Historical Library, Published Memory, production, or deployment path was changed or invoked. Required local verification for this record is Markdown integrity and changed-path review only.
