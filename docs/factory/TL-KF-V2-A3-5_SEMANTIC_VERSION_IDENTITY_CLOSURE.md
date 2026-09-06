# TL-KF-V2-A3.5 — Semantic Artifact Version Identity Closure

Status: **PASS — LOCALLY/EMULATOR CERTIFIED; NO LIVE EXECUTION**

Starting checkpoint: `f9332edcac5637acb942dbba9bdeeb99c7d9ffc6`

Machine audit: [`v2-a3-5-semantic-version-identity-audit.json`](../../artifacts/factory-v2/v2-a3-5-semantic-version-identity-audit.json)

## Result

Every implemented V2 semantic artifact family in the required A3 and B1 surface now obeys two laws:

1. **Law A — execution provenance:** equal semantic content under the same semantic contract converges on one immutable version regardless of run ID, timestamp, retry, acquisition attempt, duration, or model execution. Those observations remain in execution artifacts, operations, and private audit records.
2. **Law B — semantic evolution:** a meaning-bearing payload, parent semantic version, incompatible schema boundary, or semantic policy change produces a new immutable version. Existing versions remain readable and unchanged.

There are no remaining `SEMANTIC_VERSION_DEFECT` or `REVIEW_REQUIRED` findings in the implemented scope. B2 was not audited because it is not implemented.

## Exact A3.4 Research Map collision

The rejected write targeted:

- collection: `corpora/timelines-clean-2026-09-v1/v2ResearchMaps`;
- document: `research-map-34efed2ab3bbaa364138468c77d54998b5e303f9a13ac04fea2b8ef8695679ce`;
- topic: `36d6d69aa3bce5d0e65dbf435da523a49bec3035f7c0cc7a96a678c9e793c297`;
- scope version: `scope-002333a93acad86b19b0e08e2a96a7e45f5f40bc0d64a962dbacc1f9403623c4`, hash `df83f82c331271182dde78ec7440bd478e808457812e43f6678a22df90e9594b`;
- parent map version: `research-map-6aea5dddd6969ee4d97f330744f39c4781b8843ea6dc6796cff8fcd509bbdea5`;
- explicit map version: `2` in both constructions;
- schema/prompt: `factory-v2-a.3` / `null` in both constructions.

The existing artifact used coverage policy `knowledge-coverage-v2-a3.1`, run `v2-a3-web-98332efd-8842-490f-8ecd-d080d8789862`, timestamp `2026-09-06T15:40:38.111Z`, and payload hash `93ab19f1843caf33f12d7110ea067ce4ec906cf31b9a6fcc1abd4281f709c060`. The attempted artifact used coverage policy `knowledge-coverage-v2-a3.2`, run `v2-a3-web-cbe1e74f-2030-4c0d-8170-30178f73dab3`, timestamp `2026-09-06T18:18:01.065Z`, and payload hash `77c3d02394cf3af26fa2aa3067b101ccf81724ae6e5caaf9084d2a89ff720aa2`.

Read-only reconstruction confirmed that the map’s semantic body and parent binding were the same. The exact differing persisted fields were `policyVersion`, `runId`, `createdAt`, and consequently `payloadHash`. The old ID projection included scope ID/hash, parent map ID, completion-plan-derived map content, and map payload, but omitted the coverage semantic policy. The sealed payload included both that policy and execution provenance. Thus a legitimate `.1` → `.2` semantic-policy change and unrelated execution changes attempted to occupy one immutable ID.

The corrected rule includes schema, semantic policy, corpus/topic/generation, semantic parents, and canonical semantic content in the Research Map version ID. Its semantic envelope contains `runId:null`, `createdAt:null`, `modelExecutionRef:null`, and `promptVersion:null`. Therefore `.1` and `.2` coexist, while a retry of `.2` is byte-equivalent and idempotent.

## Engineering corrections

- Added one canonical `semanticArtifactId` path. It binds schema, semantic policy, corpus, topic, generation, and the artifact-specific semantic payload while excluding execution provenance.
- Added a provenance-neutral semantic envelope. Execution observations continue to use the strict execution envelope and `executionArtifactId`.
- Applied semantic construction to Scope Contracts, Research Maps, Query Plans, Evidence Segments, Claim Versions and edges, authority verdicts/conflicts, Publisher Authority versions, Entity/Event versions and edges, Coverage Audits, Completion Plans/Results, and B1 Selection Artifacts.
- Expanded partial ID projections to the complete canonical semantic payload. Event construction now normalizes inferred versus explicit candidate/canonical IDs before hashing.
- Bound Source Authority verdict/conflict identity to the global Source Authority semantic policy, rather than the caller’s coverage-operation policy.
- Preserved logical IDs and CAS heads for Publisher, Claim, Entity, and Event families. Exact replay no longer manufactures a successor or advances a head; semantic changes create a new immutable version and compare-and-set advancement rejects stale writers.
- Kept Source Snapshots as execution observations because retrieval time, HTTP state, exact bytes, and extraction result are part of that observation. Evidence Segments bind the exact snapshot version and extraction semantics, so incompatible extraction cannot silently reinterpret old evidence.
- Removed acquisition/source run IDs and timing/budget telemetry from Coverage and completed-knowledge semantic payloads. Their knowledge-version identity is the parent/resulting semantic set; operational telemetry remains execution evidence.
- Made B1 selection semantic identity depend on B schema, selection policy, source V2-A bundle, semantic parents, and full editorial result, while excluding run/time/source-run/model-execution provenance.
- Changed the continuation loader to fetch semantic outputs by the exact IDs returned by orchestration. Run queries remain only for legacy/execution artifacts.

## Versioning doctrine

Prompt version is execution provenance when the prompt is merely one means of obtaining an equivalent schema-valid semantic result. It does not split otherwise identical Scope, Map, Plan, Claim, Entity, Event, or Selection versions. If a prompt is promoted to a formal construction doctrine, that doctrine must receive a semantic policy version; that policy then participates in identity.

Runtime orchestration changes such as retry timing, concurrency, and transport behavior do not version semantic artifacts. Policies that define map interpretation, Source Authority classification, event resolution, coverage, or editorial selection do.

Schema versions represent persisted contract boundaries, not releases. New writes use V2-A schema `.4` and V2-B schema `.2`; parsers retain `.3` and `.1` compatibility respectively. No historical shadow artifact was rewritten. The schema change is required because semantic envelope provenance fields are nullable, while execution schemas override them as required.

Artifact IDs hash the canonical semantic construction input; `payloadHash` independently seals the complete normalized stored artifact (including its ID and constant safety envelope). This deliberate two-hash structure avoids recursion while ensuring both semantic identity and storage integrity derive from canonicalized representations.

## Complete artifact matrix

| Artifact family | Logical identity | Immutable version determinants | Execution-only | Parent semantic versions | Form / head | Verdict |
|---|---|---|---|---|---|---|
| Scope Contract | corpus/topic/generation | schema, scope policy, full scope | run/time/model | none | content-addressed / none | PASS |
| Research Map | topic + Scope version | schema, map/coverage policy, scope hash, parent map, full map | run/time/model/prompt execution | Scope, prior Map | content-addressed / none | PASS |
| Query/Research Plan | Map version | schema, policy, map/scope IDs, queries/budget | run/time/model | Scope, Map | content-addressed / none | PASS |
| Research Question | scope/map + normalized question | complete question semantics | none | Scope, Map container | nested content-addressed / none | PASS |
| Publisher Authority Version | publisherId | schema, authority policy, explicit version/effective time, full classification | caller run/topic/time | evidence, parent publisher | logical-versioned / CAS head | PASS |
| Source Identity | canonical URL | canonical credential-free HTTPS URL | retrieval/update time | none | logical record / snapshot pointer | PASS |
| Source Snapshot | source + retrieval observation | full retrieval/content/extraction observation | run/retrieval/HTTP attempt (intentionally part of observation) | Source, prior Snapshot | execution observation / none | PASS |
| Evidence Segment | snapshot + exact range/text | schema/policy, full segment, extraction semantics | consumer run/time | Snapshot | content-addressed / none | PASS |
| Atomic Claim Version | normalized proposition | schema/policy, full claim, evidence and prior version | run/time/model | Scope, Snapshot, Segments, prior Claim | logical-versioned / CAS head | PASS |
| Claim Evidence | Claim/Segment relationship | complete edge, publisher/independence/evaluator meaning | run/time | Claim, Segment, Publisher | content-addressed edge / none | PASS |
| Authority Verdict | Claim + evidence set | authority policy, claim, evidence/publisher/independence/conflict result | run/time | Claim, edges, publishers, conflict | content-addressed / none | PASS |
| Conflict Set | conflict key | policy, claims/evidence, state/materiality/resolution | run/time | Claims, edges | content-addressed / none | PASS |
| Entity Candidate/Version | typed entity identity | resolution policy, full entity/evidence/prior version | run/time/model | Segments, prior Entity | logical-versioned / CAS head | PASS |
| Event/Milestone Candidate/Version | action/entities/location/time | resolution policy, canonical IDs, full event/claims/prior version | run/time/model | Scope, Claims, Entities, prior Event | logical-versioned / CAS head | PASS |
| Entity Alias | Entity version + normalized alias | policy/schema, complete alias edge | run/time | Entity version | content-addressed edge / none | PASS |
| Event-Claim Edge | Event/Claim versions + role | policy/schema, complete edge | run/time | Event, Claim | content-addressed edge / none | PASS |
| Event-Entity Edge | Event/Entity versions + role | policy/schema, role/meaning/temporal | run/time | Event, Entity | content-addressed edge / none | PASS |
| Event Merge/Split Decision | source/result Event sets | kind, source/result versions, reason | none | Event versions | content-addressed value / none | PASS |
| Coverage Audit | stage + scope/map + knowledge set | coverage policy, parents, cells/gaps/events/verdict | source runs, duration, run/time | Scope, Map, Claims, Verdicts, Conflicts, Events | content-addressed / none | PASS |
| Gap descriptor/task | deficient locked cells | full gap/task meaning | none | Audit, Map | nested content-addressed / none | PASS |
| Completion Plan | initial audit + round | coverage policy, parents, budget/tasks | source run, run/time | Audit, Scope, Map | content-addressed / none | PASS |
| Completion research artifacts | plan applied to parent map | policy, plan/map/scope, generated questions | run/time/model | Plan, prior Map, Scope | content-addressed / none | PASS |
| Coverage Re-Audit | FINAL stage + completed knowledge | coverage policy, final knowledge and map | duration/run/time | completion Map and knowledge | content-addressed / none | PASS |
| Completed knowledge set | plan + initial/final audits | parent/result IDs, unresolved gaps, verdict | run IDs, budgets, timings | Plan, audits, Claims/Events | content-addressed / none | PASS |
| B1 significance evaluation | candidate pool under scope/map | semantic judgments and selection policy | prompt/model/usage/time | Scope, Map, Events | nested semantic + separate execution | PASS |
| B1 coverage matrix | required cells | selection policy and semantic assessment | none | Scope, Map, Events | nested in Selection / none | PASS |
| B1 redundancy decisions | event pair | relationship/evidence/rationale/policy | none | Event versions | nested in Selection / none | PASS |
| B1 omission findings | candidate under selection | reason/coverage/policy | none | Map, Event versions | nested in Selection / none | PASS |
| B1 Selection Artifact | scope/map/candidate pool | B schema, selection policy, source bundle, complete editorial result | run/time/source run/model | Scope, Map, Claim/Verdict/Conflict/Event versions | content-addressed / none | PASS |

Model Execution, B1 Selection Model Execution, Acquisition Run/Discovery, Reconnaissance, private Audit Records, Failure Records, and Topic Operations remain execution artifacts. They intentionally bind their exact run, time, attempts, response, usage, or state rather than pretending to be reusable semantic knowledge.

`Scope Amendment Proposal` and `Event Relation` currently exist only as schemas with no production constructor or persistence path. They are recorded as schema-only, not misrepresented as implemented semantic artifact flows. Their eventual constructors must adopt this doctrine before activation.

## Verification

- strict TypeScript: PASS;
- V2-A local suite: 78/78 PASS;
- B1 local suite: 10/10 PASS;
- Firestore emulator under `/opt/homebrew/opt/openjdk@21`: 5/5 PASS;
- emulator coverage: semantic-version coexistence, immutable old versions, retry idempotency, CAS heads, stale-head rejection, reference integrity, corpus isolation, and unauthenticated browser/public denial;
- property coverage: new run, timestamp, retry, policy, incompatible schema, semantic parent, execution-only parent, exact A3.4 collision, full A3 policy chain, and B1 selection-policy v1/v2;
- `git diff --check`: PASS.

No Vertex, Grounding, source retrieval, A3 fixture, or B1 fixture ran. No production write, deployment, publication, Governance submission, autonomous discovery, protected-review advancement, or `main` merge occurred.

## Production safety and proposed activation

The live SHADOW configuration was read only and remains `.11/.3/.10/.8`, with publication, Governance submission, and autonomous discovery disabled. `v2TopicOperations` has zero RUNNING operations. Published Memory remains 4 documents with comparison hash `7389246e4ff622e0183a38e89874b50e47a1a0b85e3ef447ffd39eac1a323275`; platform read models remain 46 documents with comparison hash `8cb51b3a8c6fb2eed37ebdcbd23d15c1650455427678487fcf244c986fa223e9`. Cloud Scheduler `topic-discovery-daily` remains `PAUSED`, `0 3 * * *`, UTC.

The code successor bundle is proposed as `.12/.4/.11/.8`, with B schema `.2`. It was not applied to live configuration. A later separately authorized migration must compare-and-set the live bundle before any A3 execution; this goal authorizes no Web rerun, B1 run, deployment, or publication.
