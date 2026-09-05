# TL-KF-V2-A — Evidence-First Knowledge Engine

## Certification state

**TL-KF-V2-A: NOT CERTIFIED**

V2-B is not authorized. Autonomous discovery, governance submission, publication, public projection, and public-ID allocation remain disabled for V2. The implementation is committed as an isolated shadow foundation plus diagnostic evidence; it must not be promoted to a publication-capable workflow.

The final five-topic run passed 0 of 5 fixture acceptance gates. The raw report is [`artifacts/factory-v2/v2-a-shadow-fixtures-1788651705035.json`](../../artifacts/factory-v2/v2-a-shadow-fixtures-1788651705035.json) and the concise gate record is [`artifacts/factory-v2/v2-a-certification-summary.json`](../../artifacts/factory-v2/v2-a-certification-summary.json).

## Implementation scope and authority

The implementation follows the locked V2 authority in `EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2.md`, its roadmap, the factory constitution/lifecycle/artifact/audit/error models, and the existing publication, validation, research, topic-generation, Source Authority, import, and reset boundaries. V2-A is additive under the active clean corpus and does not replace or reinterpret existing production collections.

Implemented subsystems:

- strict TypeScript/Zod contracts for scope, amendments, Research Maps, query plans, tasks, acquisition, publisher/source/snapshot/evidence, atomic claims, authority verdicts, conflicts, entities, canonical events, graph edges, model execution, failure, audit, reconnaissance, and operational state;
- deterministic canonical JSON, SHA-256 payload sealing, content-addressed IDs, and stable UUID identities;
- server-only corpus-scoped Firestore repository with allowlisted V2 collections, immutable create/idempotency, bounded batch creation, compare-and-set heads, bounded queries, and transactional edge-reference checks;
- real Vertex structured stages and Google Search Grounding provenance, with bounded transport attempts and semantic repairs;
- HTTPS source retrieval with DNS/IP SSRF checks, redirect validation, robots enforcement, response/time/size/content limits, safe HTML extraction, PDF signature validation, private Cloud Storage offload, and exact evidence segmentation;
- deterministic claim authority, Wikipedia exclusion, independence grouping, definitive-primary exception, interpretive burden, and material-conflict preservation;
- bounded entity/event resolution, non-event semantic preservation, scope containment, coarse-date preservation, and immutable revision heads;
- SHADOW-only orchestration, failure records, structured operational projection, and real five-topic fixture tooling.

## Module inventory

Runtime code is under `functions/src/factory-v2/`:

- `contracts/`: canonical schemas and builders;
- `hashing.ts`: deterministic serialization, IDs, and payload hashes;
- `acquisition/`: URL policy and durable retrieval;
- `vertex.ts`: structured model and Grounding contracts;
- `authority.ts`: publisher policy, independence, claim verdicts, and conflicts;
- `reconnaissance.ts`: bounded existing-memory inspection;
- `resolution.ts`: entity/event identity and temporal/scope logic;
- `repositories/firestore.ts`: server-only persistence;
- `orchestrator.ts`: V2-A shadow gates and metrics;
- `*.test.ts` and `repositories/*.test.ts`: unit/contract/emulator coverage.

Operational scripts are `scripts/factory-v2/bootstrap-shadow.ts`, `run-shadow-fixtures.ts`, and `verify-retrievals.ts`. `functions/src/corpus.ts`, `firestore.indexes.json`, and `functions/package.json` contain the additive collection allowlist, index definitions/index exemptions, and test/run commands.

## Firestore graph and mutability

The V2 namespace contains:

`v2ScopeContracts`, `v2ScopeAmendmentProposals`, `v2ResearchMaps`, `v2ResearchTasks`, `v2QueryPlans`, `v2AcquisitionRuns`, `v2AcquisitionDiscoveries`, `v2PublisherAuthorityRecords`, `v2PublisherAuthorityVersions`, `v2SourceDocuments`, `v2SourceSnapshots`, `v2EvidenceSegments`, `v2AtomicClaims`, `v2AtomicClaimVersions`, `v2ClaimEvidence`, `v2ClaimAuthorityVerdicts`, `v2ClaimConflictSets`, `v2CanonicalEntities`, `v2CanonicalEntityVersions`, `v2EntityAliases`, `v2CanonicalEvents`, `v2CanonicalEventVersions`, `v2EventClaims`, `v2EventEntities`, `v2EventRelations`, `v2ModelExecutions`, `v2FailureRecords`, `v2AuditRecords`, `v2TopicOperations`, and `v2ReconnaissanceRecords`.

Immutable artifacts carry schema/policy/prompt/model provenance as applicable, corpus/topic/run/generation coordinates, a recomputable payload hash, `executionMode: SHADOW`, `publicationEligible: false`, and `governanceSubmissionAllowed: false`. Mutable identity heads use transactions and expected-current-version compare-and-set semantics. Large exact text fields are exempted from indexing. Required compound-query indexes are declared but were not deployed in this goal.

## Task topology and model calls

The current executable topology is synchronous and bounded:

1. propose and lock Scope Contract;
2. inspect bounded V2 knowledge;
3. generate Research Map;
4. generate bounded Query Plan;
5. execute at most five Grounding acquisition calls in the fixture path;
6. retrieve at most 60 source documents with finite concurrency;
7. archive/snapshot/segment eligible responses;
8. extract claims from at most six authority-ranked, publisher-diverse sources;
9. evaluate authority and conflicts deterministically;
10. resolve entity/event candidates and write graph edges;
11. write final shadow operation metrics or explicit failure state.

Model stages are Scope, Research Map, Query Plan, Grounding, and claim extraction. Model executions record prompt/response hashes, model/location, validation state, repair attempt, transport attempts, grounding counts, token usage, and latency. Monetary cost is explicitly `NOT_MEASURABLE`; it is not estimated.

The `v2ResearchTasks` lease/delivery schema exists, but a durable queued worker topology is not wired. This is a certification blocker.

## Source retrieval and authority

Retrieval accepts credential-free HTTPS only. Every initial and redirected destination is DNS-resolved and rejected for loopback, private, link-local, metadata, reserved, or rebinding addresses. Redirects are manual and capped at five. The Vertex attribution relay is treated only as a navigation relay; publisher robots policy is checked after resolution and on subsequent publisher redirects. Ambiguous robots responses fail closed; only 404/410 means no policy.

Responses are capped at 25 MiB, request time at 30 seconds, robots at 10 seconds/1 MiB, and accepted MIME types are explicit. Compressed responses are rejected to prevent decompression bypass. PDF MIME requires a `%PDF-` signature. HTML extraction strips scripts, styles, frames, templates, SVG, and comments without executing content. Source text is bracketed as untrusted data in model prompts. Large/PDF bodies use private Cloud Storage objects; no public URLs are generated.

The small policy-admitted Publisher Authority registry includes NASA, CERN, W3C, German and U.S. national archives, JFK Library, State Department Office of the Historian, Smithsonian Air and Space Museum, Berlin Wall Foundation, IWM, Computer History Museum, AP, Reuters, BBC, Britannica, and Wikimedia. Unknown domains receive stable PROVISIONAL identities and cannot satisfy STRONG authority. Wikipedia remains orientation/discovery-only.

Claim decisions are categorical. A claim needs direct evidence segments from durable snapshots, a claim type and risk, and a deterministic verdict. Definitive primary records can satisfy narrow material facts; interpretive claims require two independent strong secondary groups; sensitive claims always require human review; unresolved material conflicts block PASS.

## Existing knowledge and resolution

Reconnaissance is bounded to V2 Production Memory and explicitly excludes legacy content as authority. Stable entity and event heads can be reused through current-version lookups and immutable successor versions. Exact typed external IDs outrank alias and normalized-name/geography matching. Event identity uses action, primary entities, locations, and temporal interval—not title or embedding similarity. Same-day distinct actions remain distinct. `STATE_LEGACY`, `CONTEXT`, and `FUTURE` artifacts are ineligible for canonical chronology events.

The reusable-knowledge classifier and reconnaissance records are implemented, but source-snapshot cache reuse is not wired into the live acquisition path (`cacheHits` was zero). Existing admitted knowledge is inspected but not yet reused end-to-end for claim/event production. This is a certification blocker.

## Shadow and production boundary

`factoryV2/config` was bootstrapped in project `tiimeliines` with SHADOW mode and all autonomous/public/governance capabilities false. Real fixtures wrote only additive `v2*` subcollections under corpus `timelines-clean-2026-09-v1` and private institutional-archive objects. No function, index, rule, application, or public-route deployment occurred. Existing readers, Published Memory, public APIs, timeline review items, public IDs, and `main` were not modified by runtime code.

The final read-only production audit found zero RUNNING V2 operations and zero `publishedMemory` records with pipeline version `factory-v2-a.1`. The preserved Cuban Missile Crisis topic/job (`7d83e1…` / `a5c29a9e…`) and Apollo 13 topic/job (`8f8c58de…` / `1190ca33…`) remain `AWAITING_REVIEW` with their original 2026-09-05 update timestamps. Cloud Scheduler job `topic-discovery-daily` remains `PAUSED` in `us-central1` on `0 3 * * *` UTC.

## Test and security evidence

Focused unit tests cover schema strictness, immutable/hash behavior, scope binding, Research Map coverage, query normalization, atomicity, claim typing/risk, evidence binding, independence, conflicts, publisher policy, Wikipedia exclusion, identity, semantic classes, temporal precision, merge/split decisions, safe URL handling, redirects, SSRF, robots, response bounds, HTML/PDF processing, access limitations, cache eligibility, prompt isolation, malformed structured output, bounded repair, and retry limits.

Firestore emulator tests cover corpus paths, immutable idempotency/collision handling, bounded batch writes, compare-and-set heads, edge referential integrity, bounded queries, reconstruction, full shadow orchestration, and unauthenticated browser read/write denial. Real retrieval validation over 60 prior Grounding discoveries produced 31 newly retrieved, 18 unavailable, one access-limited, and 10 rejected results with zero invalid snapshot/evidence hashes.

Final verification passed: root regressions 249/249; Functions regressions 82/82; editorial certification 68/68; Historical Library 7/7; Published Memory 7/7; Projection Engine 7/7; Search 8/8; Platform 8/8; V2 Firestore emulator/security/integration tests 3/3; root and Functions typechecks; ESLint; Functions TypeScript build; and the Next production build. Both production dependency audits returned zero high/critical findings. They reported eight transitive moderate `uuid` findings; the automated recommendation requires breaking dependency changes and was not forced into this goal. No deployment was used to obtain fixture evidence.

## Final fixture evidence

| Fixture | Result | Evidence | Blocking gate |
|---|---|---|---|
| History of the World Wide Web | FAIL | 884,321 ms; 75 discovered; 54 snapshotted; 1 extracted claim; 0 supported claims; 0 events | `NO_SUPPORTED_CLAIMS`, `NO_RESOLVED_EVENT_CANDIDATES` |
| Fall of the Berlin Wall | FAIL | Reached entity construction after live source/claim work | duplicate identity-evidence list rejected by immutable schema; loaded process preceded deduplication fix |
| Apollo 11 Mission | FAIL | Real Scope/Research Map executions persisted | Research Map repair exhausted on short IDs and unsupported `DESCRIPTION` claim type |
| Cuban Missile Crisis | FAIL | Reached entity construction after live source/claim work | duplicate identity-evidence list rejected by immutable schema; loaded process preceded deduplication fix |
| Apollo 13 Mission | FAIL | Real Scope/Research Map executions persisted | Research Map repair exhausted on unsupported `FACTUAL`/`CAUSAL` claim types |

The Web fixture made the future latency target implausible for the current topology: 14.7 minutes exceeds the `<12 minutes` p95 target, although it remains below 20 minutes. One fixture is insufficient for p50/p95 computation. The current orchestrator records a 1,200-second budget but does not enforce a whole-run cancellation deadline across all stages; only individual external calls are finite. This is a certification blocker.

## Known limitations and exact blocking gates

1. Five-fixture acceptance is 0/5.
2. Research Map provider-constrained output is not reliable across the Apollo fixtures after bounded repair.
3. Supported-claim/event yield is insufficient on the completed Web fixture.
4. The identity-evidence deduplication fix has not passed a fresh five-fixture rerun.
5. Durable `v2ResearchTasks` worker leasing/delivery is not wired into live orchestration.
6. Source cache reuse and end-to-end admitted-knowledge reuse are not wired.
7. The 1,200-second whole-run deadline is not actively enforced.
8. The measured 14.7-minute Web run misses the future 12-minute p95 target; five successful timing samples do not exist.
9. Required production indexes/rules/functions were intentionally not deployed.
10. Hard fixture invariants therefore have not been demonstrated across all five topics.
11. Eight transitive moderate dependency advisories remain; no high/critical production advisory is present.

## Remaining V2-B dependencies

V2-B must not start. A new V2-A goal must first stabilize constrained Research Map output, wire durable tasks and cache/reuse, enforce whole-run cancellation, improve atomic claim yield without weakening authority, rerun all five topics post-fix, pass every hard invariant, and produce enough successful timing/cost observations for certification.
