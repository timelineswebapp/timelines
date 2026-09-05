# Evidence-First Knowledge Factory V2 — Implementation and Certification Roadmap

Roadmap ID: `TL-KNOWLEDGE-FACTORY-V2-ROADMAP-001`

Status: **LOCKED EXECUTION ROADMAP**

Authority level: Tier-3 Factory Execution Authority, subordinate to `EVIDENCE_FIRST_KNOWLEDGE_FACTORY_V2.md` and all Tier-1/Tier-2 constitutional authority

Decision date: 2026-09-05

Implementation status: **NOT STARTED**

Production authorization: **NONE**

## 1. Roadmap decision

Factory V2 shall be implemented as an additive, corpus-scoped, shadow-first program. The existing public and institutional runtime remains unchanged until V2 passes authority reconciliation, component certification, heterogeneous shadow certification, and one separately authorized live certification.

```text
0. Authority reconciliation
  -> 1. V2 schemas, repositories, flags, storage, and isolation
    -> 2. Scope, reconnaissance, research map, and acquisition
      -> 3. Atomic claims and Source Authority adaptation
        -> 4. Entity and event resolution
          -> 5. Significance and coverage selection
            -> 6. Targeted evidence completion
              -> 7. Immutable event lock
                -> 8. Constrained writer and prose claim check
                  -> 9. Institutional adapters
                    -> 10. Shadow certification
                      -> 11. Explicit live certification and priority cutover
                        -> 12. Monitored priority operation and autonomous-readiness decision
```

No phase begins authority-bearing work before the preceding phase certificate exists. Parallel engineering is allowed only after shared contracts are locked and only where outputs cannot conflict.

## 2. Binding architecture and non-scope

This roadmap implements, and does not redesign:

```text
scope-controlled inquiry
  -> durable sources
    -> atomic verified claims
      -> resolved reusable events
        -> significance/coverage selection
          -> targeted evidence completion
            -> immutable event lock
              -> constrained prose
                -> Governance
                  -> Historical Library
                    -> Published Memory
                      -> projections
                        -> public platform
```

This roadmap grants no permission for deployment, production writes or requests, Governance replay/advancement, timeline regeneration, existing evidence or Published Memory mutation, autonomous discovery resumption, `main` merge, or a graph database.

## 3. Current production safety contract

The implementation baseline is:

- active corpus `timelines-clean-2026-09-v1` with `NO_LEGACY_CONTENT_REUSE`;
- Apollo 11 generation 2 remains active;
- the Web and Berlin Wall remain available;
- Cuban Missile Crisis and Apollo 13 remain untouched in exceptional review;
- autonomous discovery remains paused;
- User/Admin priority intake stays on current V1/V3 logic until the controlled cutover;
- legacy pre-reset root collections remain archive/rollback only;
- current Governance, Historical Library, Published Memory, Projection, Search, public IDs, routes, and DTOs remain operational.

Every V2 task/artifact carries `corpusId`, `topicId`, `generation`, `pipelineVersion`, `executionMode`, `schemaVersion`, and exact policy versions. `executionMode` is `SHADOW`, `LIVE_CERTIFICATION`, or `PRODUCTION`. Shadow code has no institutional-delivery capability in IAM or code.

## 4. Intake and mixed-version policy

`pipelineVersion` is pinned at intake and never changes for that generation.

| Operating mode | User/Admin intake | Autonomous | Publication behavior |
|---|---|---|---|
| `CURRENT_PRODUCTION` (Phases 0–9) | Current V1/V3 unchanged | Discovery paused; already queued legacy tasks follow their pinned version | Existing path only |
| `V2_SHADOW` (Phase 10) | Current V1/V3 unchanged; a topic already owned by production cannot enter shadow | Paused | V2 shadow cannot submit/publish |
| `V2_CERTIFICATION_DRAIN` | Requests persist as `PENDING_V2`; no new V1/V3 priority jobs | Paused | Existing in-flight V1/V3 may finish; exceptional items untouched |
| `V2_CERTIFICATION` | General priority held; exactly one authorized generation pinned V2 | Paused | Only the certification package may use the adapter |
| `V2_PRODUCTION` | New User/Admin generations pinned V2 | Paused until separate release | V2 priority enabled after `LIVE-001` |
| `V2_AUTONOMOUS_RAMP` | V2 | V2 under staged quotas | Same V2 institutional gates; no bypass |

At intake, a transaction reads configuration and creates one generation ownership tuple `(corpusId, topicId, generation, pipelineVersion)`. A unique active-generation guard prevents a second pipeline from owning the same topic. Shadow may compare the same subject only under an explicit nonpublishable shadow generation namespace and may not acquire production ownership.

Task envelopes contain `taskContractVersion`, `pipelineVersion`, `artifactPolicyBundleVersion`, `operatingModeAtEnqueue`, generation, checkpoint input hash, and cutover epoch. Workers accept only declared compatible contracts and exact artifact policy. Stale mode/epoch, wrong pipeline, released lease, completed checkpoint, or unsupported task version is acknowledged as `STALE_NOOP` with an audit record; it never executes against V2 artifacts. Unknown versions fail closed and alert.

The cutover switch is one configuration transaction from certification to `V2_PRODUCTION` after `LIVE-001`; it affects new generations only. The rollback switch sets intake to `CURRENT_PRODUCTION` or `HOLD`, disables V2 enqueue, drains/pauses V2 delivery, and preserves V2 artifacts. It never rewrites an existing generation to V1/V3. V1/V3 in-flight work either finishes under its pinned version or is explicitly cancelled and regenerated later with a new generation identity. V1/V3 artifacts and exceptional packages remain interpretable only under recorded versions and are never silently upgraded.

## 5. Phase 0 — Authority reconciliation

| Document | Exact issue | Controlling authority | Required amendment / certification |
|---|---|---|---|
| `docs/architecture/PUBLICATION_CONSTITUTION.md` | Calls Milestones non-canonical, then Law 4 canonical; calls Published Memory a projection | Product Constitution V2, Schema Canon V2, Institutional Architecture, Law 4 | Remove Milestones from non-canonical list; lock Event as persistence/public term; Published Memory preserves admitted authority; consistency test |
| `docs/architecture/INSTITUTIONAL_ARCHITECTURE.md` | Projection derives membership without the immutable Factory view-spec lineage | Product Constitution and V2 design | Define hash-bound non-authoritative view-spec reference and exact admitted-event matching; architecture trace review |
| `docs/architecture/DOMAIN_MODEL.md` | Lacks technical view-spec lineage | V2 design | Add view/membership as Factory technical artifacts excluded from Governance authority mapping; vocabulary test |
| `docs/constitution/HISTORICAL_LIBRARY_CONSTITUTION.md` | Published Timeline Views are not distinguished from event facts | Product/Schema canons | Library admits facts and preserves view-spec lineage without converting it to authority; Library review |
| `Knowledge/01_PRODUCT_CONSTITUTION_V2.md` | Membership authority implicit | Existing doctrine | State membership is editorial narrative selection, never event truth; product review |
| `Knowledge/02_ARCHITECTURE_CANON_V2.md` | Certified path predates V2 primitives | Institutional Architecture | Add V2 as internal Factory sequencing only; boundary test |
| `Knowledge/03_SCHEMA_CANON_V2.md` | Missing ownership for claims/events/views/locks | Product/Architecture canons | Add one explicit owner and candidate/admitted lifecycle per entity; ownership test |
| both Authority Indexes | Duplicate registries and stale PostgreSQL “current” claims | Certified Firestore status and Knowledge V2 canons | Declare current precedence, preserve legacy evidence, register V2 design/roadmap; link/status audit |
| Factory Constitution/Architecture | Design registered; roadmap not registered | Factory Constitution | Register this roadmap at Tier 3; reference audit |

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-AUTHORITY-001`.

It requires zero conflicting normative uses of Milestone/Event/Timeline View/Membership/Published Memory, zero authority movement to Factory or Projection, resolved links, and human authority-steward approval. No runtime implementation begins before it passes.

## 6. Phase 1 — V2 primitives and Firestore isolation

### 6.1 Namespace decision

Use first-class prefixed collections:

```text
corpora/{ACTIVE_CORPUS_ID}/v2ScopeContracts/{id}
corpora/{ACTIVE_CORPUS_ID}/v2AtomicClaimVersions/{id}
corpora/{ACTIVE_CORPUS_ID}/v2CanonicalEventVersions/{id}
```

Do not use a nested `knowledgeV2/{singleton}/...` tree. First-class collections fit `corpusCollection()`, collection-scoped indexes, emulator fixtures, migration verifiers, and bounded queries. Explicit `v2` names are inaccessible to current public repositories and remain permanent after cutover, avoiding rename migration.

Use a separate `v2CorpusCollection()` allowlist and shadow service account. Public repositories remain unchanged until Phase 11.

### 6.2 Collection/artifact matrix

Size targets are serialized Firestore document sizes before index overhead. Immutable artifacts retain indefinitely; large bodies/raw responses live in the existing versioned private archive.

| V2 collection | Existing equivalent | Action | Owner / mutability | Deterministic ID | Indexes, size, offload |
|---|---|---|---|---|---|
| `v2ScopeContracts` | scope inside quality artifact | NEW | Factory; immutable versions | corpus/topic/generation/version/payload hash | topic+generation+version; <=64 KiB |
| `v2ResearchMaps` | eras/dimensions in plan | NEW | Factory; immutable | scope ID + payload hash | topic+scope; <=128 KiB |
| `v2ResearchTasks` | stage strings | NEW | Factory ops; mutable state, immutable result | UUID task + deterministic delivery | run+state+priority; <=32 KiB |
| `v2QueryPlans` | provider `webSearchQueries` only | NEW | Factory; immutable | map+role+payload hash | map+role; <=64 KiB |
| `v2AcquisitionRuns` | factory run/research metrics | ADAPT | Factory; immutable attempts | run+stage+attempt | topic+stage+time; <=64 KiB |
| `v2PublisherAuthorityRecords` | hard-coded domain priors | NEW head | Source Authority; audited mutable pointer | stable verified publisher UUID | name key, domain keys, state; <=32 KiB |
| `v2PublisherAuthorityVersions` | source inventory entries | NEW | Source Authority; immutable | publisher+content hash | publisher+version; <=64 KiB |
| `v2SourceDocuments` | `sourceRecords` | ADAPT | Source Authority; mutable head | canonical identity hash | canonicalUrlHash, publisher; <=32 KiB |
| `v2SourceSnapshots` | `sourceSnapshots` | ADAPT, never overwrite | Source Authority; immutable | source+content+retrieval hash | source+retrievedAt, contentHash; metadata <=64 KiB; body offload >256 KiB |
| `v2EvidenceSegments` | grounding segments/evidence records | ADAPT | Evidence; immutable | snapshot+segment hash | snapshot+hash; <=16 KiB |
| `v2AtomicClaims` | no atomic head | NEW head | Factory candidate/Library admitted | stable resolved UUID | subject+predicate, state; <=16 KiB |
| `v2AtomicClaimVersions` | event description as claim | NEW | Factory/Library by lifecycle; immutable | claim+payload hash | claim+version, scope+risk+state; <=32 KiB |
| `v2ClaimEvidence` | claim links | ADAPT edge | Evidence; immutable | claim version+segment+relation hash | claim, segment, independence; <=16 KiB |
| `v2ClaimAuthorityVerdicts` | Source Authority claims | ADAPT | Source Authority; immutable | claim+policy+evidence-set hash | claim+policy+verdict; <=64 KiB |
| `v2ClaimConflictSets` | conflict strings | NEW | Source Authority/Governance review; immutable versions | normalized conflict+version hash | claim key+state; <=64 KiB |
| `v2CanonicalEntities` | historical-object candidates | ADAPT head | Factory candidate/Library admitted | stable UUID | type+name, external IDs; <=16 KiB |
| `v2CanonicalEntityVersions` | Factory objects | ADAPT | Factory/Library; immutable | entity+payload hash | entity+state+version; <=32 KiB |
| `v2EntityAliases` | none | NEW edge | Entity authority; versioned | language+alias+entity hash | alias+language+type; <=8 KiB |
| `v2CanonicalEvents` | candidate/public events | NEW head | Factory candidate/Library admitted | stable UUID after admission | identity key+state; <=16 KiB |
| `v2CanonicalEventVersions` | candidate milestones | ADAPT | Factory/Library; immutable | event+payload hash | temporal+semantic, entity key, scope; <=64 KiB |
| `v2EventClaims` | implicit description | NEW edge | Factory/Library; immutable | event+claim+role hash | event+role, claim; <=8 KiB |
| `v2EventEntities` | participations | ADAPT edge | Factory/Library; immutable | event+entity+role hash | event, entity+temporal; <=16 KiB |
| `v2EventRelations` | relationships | ADAPT edge | Factory/Library; immutable | endpoints+predicate+evidence hash | from+predicate, to; <=16 KiB |
| `v2RankedCandidateSets` | significance scores | NEW | Editorial Intelligence; immutable | policy+candidate-set+execution hash | topic+scope; <=256 KiB; offload above |
| `v2CoverageCells` | era distribution | NEW edge | Editorial Intelligence; immutable | candidate+phase+dimension+map hash | candidate; phase+dimension+coverage; <=8 KiB |
| `v2TimelineViewSpecifications` | candidate timeline | ADAPT | Editorial Intelligence; immutable | content hash | topic+generation; <=64 KiB |
| `v2TimelineEventMemberships` | embedded event order | NEW edge | Editorial Intelligence; immutable | view+event hash | view+ordinal, event; <=16 KiB |
| `v2LockedEventSets` | none | NEW | Editorial Intelligence; immutable/supersedable | all exact refs/policies hash | topic+generation; <=256 KiB; offload above |
| `v2WriterArtifacts` | Editorial Narrative/timeline prose | ADAPT | Editorial Intelligence; immutable attempts | lock+policy+attempt+response hash | lock+attempt; <=256 KiB; raw offload |
| `v2ProseClaimChecks` | none | NEW | Editorial Intelligence; immutable | writer+checker+payload hash | writer+verdict; <=128 KiB |
| `v2ModelExecutions` | embedded execution metadata | ADAPT | Factory audit; immutable | execution UUID + request/response hashes | run+stage+start; prompt/response offload |
| `v2FailureRecords` | embedded error strings/admin operations | NEW | Factory audit; immutable attempts | run+stage+failure class+attempt+payload hash | topic+state+time, class+severity+time; <=64 KiB |
| `v2TopicOperations` | Topic Ledger + distributed stage state | NEW read model | Factory operations; transactionally replaced snapshot | corpus+topic+generation+pipeline | origin+state+updatedAt, blocking class+time; <=64 KiB |
| existing institutional/public collections | certified runtime | KEEP | Existing owners/contracts | Existing | No Phase 1 change |

All records also carry schema/policy versions, payload hash, corpus/topic/run/generation, time, and lineage. Unbounded relations use edge documents, never arrays.

### 6.3 Build units, migration, rollback

1. Strict contracts in `functions/src/factory-v2/contracts/`.
2. Canonical JSON hashing and typed envelopes.
3. `v2CorpusCollection()` compile-time allowlist.
4. Repository-only persistence under `functions/src/factory-v2/repositories/`.
5. Composite indexes and index exemptions for large text/payloads.
6. Emulator fixtures for idempotency, version heads, edge integrity, and at-least-once delivery.
7. `factoryV2/config` with `operatingMode`, `priorityPipelineVersion`, `autonomousPipelineVersion`, exact artifact-policy bundle, budget bundle, cutover epoch, and kill switch.
8. Shadow IAM with no institutional invocation permission.
9. Transactional Topic Ledger ownership lease keyed by topic/generation/pipeline version and a projection-only operations read model.

Planned scripts, dry-run by default:

- `scripts/factory-v2/plan-schema.ts`;
- `bootstrap-publisher-registry.ts`;
- `import-active-legacy-knowledge.ts`;
- `verify-isolation.ts`;
- `certify-storage.ts`;
- `disable-shadow.ts`.

Rollback sets mode `OFF`, pauses shadow tasks, and deploys the prior revision. It preserves immutable V2 data. Cleanup may expire abandoned mutable leases only after immutable completion/failure records exist; the V2 names remain permanent.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-PRIMITIVES-001`. It requires schema/repository/emulator/index/size/IAM/idempotency/hash/isolation tests, no public/institutional imports of V2 repositories, max fixture documents below 75% of Firestore's 1 MiB limit, edge-based unbounded relationships, and rollback with unchanged existing corpus hashes.

## 7. Existing data reuse

| Existing domain | Classification | Rule |
|---|---|---|
| Topic Ledger | REUSE DIRECTLY + ADAPT | Preserve identity/origin/generation/priority/history; add pinned pipeline/mode fields only |
| Public/canonical IDs | REUSE DIRECTLY | Preserve URLs; allocate new only after admitted new identity |
| Governance/Library records | REUSE DIRECTLY | Immutable lineage; never reinterpret decisions |
| Published Memory | REUSE DIRECTLY as admitted legacy authority input | Read-only reconnaissance; reference, never mutate |
| Public projections | SHADOW ONLY | Equivalence comparison; never factual evidence |
| Existing events/milestones | IMPORT AS LEGACY KNOWLEDGE + RE-VALIDATE | Seed candidates; never automatic canonical V2 events; Apollo 11 g2 first |
| Timeline membership/order | IMPORT AS LEGACY KNOWLEDGE | Editorial precedent only |
| Source records | RE-VALIDATE | Identity hints/URLs require canonical URL, publisher, document resolution |
| Source snapshots | SHADOW ONLY or RE-VALIDATE | Existing grounding responses are `GROUNDING_EXCERPT`, never relabeled full snapshots |
| Grounding segments | IMPORT AS LEGACY KNOWLEDGE | Preserve exact spans; rebind only after source identity/claim extraction |
| Evidence records/claim links/validations | IMPORT AS LEGACY KNOWLEDGE | Structural PASSED is not atomic authority sufficiency |
| Source Authority artifacts | RE-VALIDATE | Bootstrap priors/compare verdicts; never copy event-description verdict to atomic claims |
| Quality artifacts | SHADOW ONLY | Regression input, not Scope Contracts |
| Factory objects/artifacts | IMPORT AS LEGACY KNOWLEDGE | Preserve lineage via explicit importer records |
| Pre-reset root corpus | DO NOT MIGRATE | Archive/rollback; never V2 input |

Every import reference records source collection/document/hash, migration ID, and classification. No importer updates current records.

## 8. Phase 2 — Acquisition engine

### 8.1 Existing module decisions

| Module | Decision | V2 use |
|---|---|---|
| `topic-ledger.ts` | ADAPT via versioned adapter | pin pipeline/mode; retain identity, priority, leases, rate limits |
| `normalization.ts` | KEEP/ADAPT | topic hash; add typed URL/entity/claim keys separately |
| `vertex.ts` | SPLIT | keep provider client/retry metadata; replace monolithic calls with stage clients |
| `pipeline.ts` | RETIRE for new V2 after cutover; freeze for legacy | checkpointed orchestrator replaces monolith |
| `persistResearch()` | REPLACE | discovery, source identity, retrieval, extracted text, evidence are separate |
| `researchTopic()` | REPLACE | five explicit search roles |
| `generateEditorialPlan()` | REPLACE | scope/map/resolution/selection become separate |
| `generateStructuredTimeline()` | REPLACE for V2 | constrained post-lock writer |
| `corpus.ts` | KEEP + V2 allowlist | preserve active-corpus checks |
| `tasks.ts` | ADAPT | stage payload and deterministic checkpoint IDs |

### 8.2 Exact Vertex call contracts

Initial model is the current `gemini-2.5-flash`, temperature 0, structured output, server credentials, versioned prompts/schemas, and persisted hashes. Model change requires recertification.

| Call | Purpose/input | Output/max | Tools | Timeout; retries; semantic repair |
|---|---|---|---|---|
| `v2_scope_proposal` | topic, origin, date context, bounded recon; 16k input | Scope proposal; 3k | none | 60s; 3 transport; 2 schema repairs |
| `v2_research_map` | locked scope + recon gaps; 24k | map; 6k | none | 90s; 3; 2 repairs |
| `v2_query_plan` | map + priors + budget; 16k | query plan; 4k | none | 60s; 3; 1 repair |
| `v2_orientation_search` | scope/map/orientation plan; 20k | grounded discovery; 6k | Google Search | 120s; 3; 1 malformed-output repair |
| `v2_map_acquisition_search` | assigned questions; 20k/bundle | grounded discovery; 6k | Google Search | 120s; 3; 1 repair |
| `v2_authority_search` | named authority gaps; 16k | grounded discovery; 6k | Google Search | 120s; 3; 1 repair |
| `v2_url_context_extract` | supplied URL/retrieved text; 50k | structured sections; 8k | URL context only | 120s; 3; 1 repair |
| `v2_atomic_claim_extract` | snapshot chunk; 50k | claims + exact selectors; 12k | none | 150s; 3; 2 repairs |
| `v2_claim_semantic_assess` | bounded claims/evidence; 32k | relevance/risk/conflicts; 8k | none | 120s; 3; 1 repair |
| `v2_entity_adjudicate` | max 20 identity candidates; 24k | match/distinct/review; 6k | none | 90s; 3; 1 repair |
| `v2_event_adjudicate` | claim clusters; 40k | event resolutions; 10k | none | 150s; 3; 2 repairs |
| `v2_significance_compare` | stable candidate batch; 40k | comparisons/rationales; 8k | none | 120s; 3; 1 repair |
| `v2_completion_search` | exact selected claim gaps; 16k | grounded evidence; 6k | Google Search | 120s; 3; one repair, global 2-call max |
| `v2_writer` | lock/claims/style; 32k | writer artifact; 10k | none | 120s; 3; max 2 prose repairs |
| `v2_prose_claim_extract` | prose + allowed keys; 24k | assertion mappings; 8k | none | 90s; 3; 1 schema repair |

Each execution persists model/location, prompt/schema/policy versions, input IDs/hashes, prompt/response hashes, usage, timestamps, provider queries/supports, retry/repair class, and budget consumption. Transport retries repeat identical input. Semantic repairs are new immutable executions and cannot alter locked upstream artifacts.

### 8.3 Executable search roles

| Role | Maximum/concurrency | Stop |
|---|---|---|
| Orientation | 1 grounded / 1 | attributable supports persisted or exhausted |
| Phase/dimension | 3 grounded / 3 | critical questions satisfied/blocked or budget exhausted |
| Authority-targeted | 1 grounded / 1 | target acquired or unavailable |
| Source retrieval | 60 docs; 6 HTTP, 3 extraction workers | every URL retrieved/limited/rejected/duplicate/failed |
| Evidence completion | 2 grounded, 12 queries / 2 | claims pass, substitution starts, or exhausted |

Global limits: 7 grounded calls, 40 reported queries, 60 retrieved documents, 300 atomic claims. Normalize/deduplicate planned queries before dispatch; preserve actual provider queries verbatim. Deduplicate sources by canonical URL and content hash, retaining all retrieval/discovery paths. Cache reuse requires compatible freshness and unchanged content validators.

Search stops on scope amendment, budget exhaustion, all critical questions resolved, unattributable grounding after allowed attempts, prohibited/access-denied source, or mandatory human conflict.

### 8.4 Durable retrieval

```text
grounding discovery -> URL validation -> SSRF-safe DNS/IP check -> bounded HTTPS redirects
-> canonical URL -> access/robots/license decision -> media retrieval -> raw hash/archive
-> deterministic extraction -> immutable snapshot -> evidence segments
```

- Reject non-HTTPS, URL credentials, localhost, private/link-local/multicast/reserved/metadata destinations and DNS rebinding at every redirect.
- Maximum five redirects, 30-second network timeout, 25 MiB direct-download cap, strict MIME/signature validation.
- HTML: raw private bytes, sanitized deterministic main-text/headings extraction; never execute scripts.
- PDF: signature/MIME and malware checks, page-indexed text; OCR only if needed with provenance.
- Structured pages: preserve JSON-LD/table fields separately.
- Paywall/login/robots denial: mark limited/unavailable; never bypass.
- Unsupported audio/video: metadata only unless an authorized transcript is retrieved.
- Large bodies: versioned Cloud Storage object/generation plus hashes in Firestore.
- Original language retained; translations are derivative and never independent.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-ACQUISITION-001`, covering SSRF, redirects, formats, access limits, languages, cache/freshness, budgets, Grounding lineage, and proof that grounding output cannot masquerade as a full source snapshot.

## 9. Phase 3 — Atomic claims and Source Authority V2

Implement a versioned predicate registry for `OCCURRENCE`, `DATE`, `IDENTITY`, `LOCATION`, `QUANTITY`, `INSTITUTIONAL_ACTION`, `RELATIONSHIP`, `ATTRIBUTION`, `QUOTATION`, `CAUSATION`, `INTERPRETATION`, and `CONSEQUENCE`. Each predicate locks subject/object types, qualifiers, normalization, temporal shape, risk floor, and evidence burden.

Gemini proposes claim boundaries/types, exact spans, risk indicators, semantic directness, conflicts, and qualifications. Deterministic code validates IDs/hashes, predicate typing, atomicity, dates/units/quantities/quotes/languages, source accessibility, dependence, risk floor, burden, and lifecycle.

### 9.1 Source Authority adaptation

Do not replace Source Authority V2.

| Current check | Move to | Cost rule |
|---|---|---|
| publisher/domain prior | source identity | once per publisher version |
| primary/secondary role | claim-evidence assessment | once per claim/source use |
| relevance | claim evidence | once per claim/evidence-set version |
| parent independence | claim verdict | deterministic cached lookup |
| risk | predicate/claim creation | once per claim version |
| corroboration/definitive primary | claim verdict | once per evidence-set version |
| conflict detection | conflict set | once per comparable set |
| evidence selection | event-lock preparation | deterministic from passing verdicts |
| event coverage | lock gate | once per lock |
| ownership/hash/snapshot checks | final integrity gates | before handoff and institutional transition; no model |

Semantic assessments are content-addressed by claim version + evidence-set hash + authority policy. Unchanged inputs reuse results.

Claim lifecycle: `EXTRACTED -> STRUCTURALLY_VALID -> AUTHORITY_PENDING -> SUPPORTED | QUALIFIED | REJECTED | REVIEW_REQUIRED`. New evidence makes a new version/verdict. Routine publication cannot use unresolved conflicts; sensitive or materially contested claims require human review.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-CLAIMS-001`. Fixtures cover all types/risks, exact quotes, date/quantity conflicts, self-interested primary interpretation, parent duplicates, syndication, unrelated prestige, Wikipedia-only evidence, multilingual translation, supersession, rejection, and human review.

## 10. Publisher registry and Wikipedia

Bootstrap only publishers verified in the five regression subjects: NASA; CERN; W3C; relevant US/German archives and institutions; Smithsonian/IWM; AP/Reuters/BBC; Britannica/EBSCO; and Wikimedia as orientation-only. Domain patterns never create verified status. Other publishers start provisional/unclassified.

Versions record identity, parent, independence group, authority domains, language/geography, institutional mandate/editorial process evidence, source tendency, domains, amendments, reviewer/policy, and audit history. Parent changes create new versions and never rewrite old assessments.

Wikipedia implementation:

- persist orientation records as `ORIENTATION_ONLY`;
- harvested links carry `discoveredViaSourceId` and `discoveryPathHash`;
- independently retrieve/snapshot/classify the linked document;
- fail a claim verdict if Wikipedia/mirrors satisfy burden;
- never infer independence from a different URL;
- lock verifier proves no allowed claim evidence is orientation-only.

## 11. Phase 4 — Entity/event resolution and reuse

Entity order: exact external ID; alias+type+language; canonical name+dates/geography; at most 20 embedding candidates; model adjudication; human review. Embeddings are retrieval projections outside authority hashes and never own identity.

Event queries are bounded one-hop lookups using exact identity key; entity key plus temporal range; concept/location projection keys; and at most 50 results per paginated query. Resolve core action/transition, participants, temporal interval, location, granularity, and core claims. Same-day events remain distinct when action/role differs. Processes use intervals/children. `STATE_CHANGE` is an EVENT subtype; STATE_LEGACY/CONTEXT/FUTURE remain private.

Merge/split creates immutable decisions and versions. No embedding/title/source match merges authority alone.

Reuse admitted heads before same-run candidates. Revalidate only for higher-risk use, new conflicts, changed source/publisher versions, ongoing facts, or unavailable preserved evidence. Research only explicit gaps.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-RESOLUTION-001`, with exact/alias/external-ID/multilingual/same-name, same-day, uncertainty, process, state, merge/split, false-neighbor, reuse, and query-bound fixtures.

## 12. Phase 5 — Event selection

The research/event pool supports 30–100 candidates (and 300 claims); it is never capped at 20. Public hard maximum remains 20. Standard target is 10–20; 6–9 requires the pre-locked exception.

1. Deterministically remove non-events, scope violations, conflicts, insufficient burden, duplicates, and incompatible dates.
2. Mark boundary/turning-point candidates for ESSENTIAL comparison.
3. Stable-batch exact candidate IDs by phase/chronology.
4. Model performs pairwise/comparative judgments; no universal numeric sum.
5. Persist every comparison and exact ranked candidate set.
6. Deterministically include essential opening/terminal/turning points.
7. Satisfy required phase/dimension PRIMARY cells using lexicographic rank and stable ID ties.
8. Add MAJOR then SUPPORTING events to explanatory completeness/count limit.
9. Remove redundant lower-ranked events and recheck coverage.
10. Fail when required coverage/material omission cannot fit within 20.

Replay reuses the immutable ranking artifact. Changed candidates/policy require a new ranking. Ongoing topics cover the material phase as of `ongoingAsOf`; closed episodes require evidenced opening/terminal events within boundaries. Source density never breaks a tie.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-SELECTION-001`, repeating 30/50/100-candidate fixtures for stable IDs/hashes, max 20, coverage, omissions, boundaries, redundancy, and no score arithmetic.

## 13. Phase 6 — Targeted evidence completion

Create one gap per failing selected claim, grouped into at most two compatible authority calls. Store claim/risk/missing burden/preferred source class/named authority/date-quantity-conflict need/excluded groups/budget.

- maximum two calls and twelve reported queries;
- no scope expansion or unrelated event generation;
- new immutable snapshots/segments/claim versions/verdicts;
- passing claims create a new provisional event version;
- at most two deterministic substitutions from the ranked set;
- substitutes independently pass coverage and burden;
- essential failure routes to escalation/review;
- exhaustion never authorizes more automatic search.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-COMPLETION-001`, proving exact budgets, dates, definitive-primary exception, independence, conflicts, weak rejection, substitutions, and no search-until-success loop.

## 14. Phase 7 — Locked Event Skeleton

Inputs: exact Scope/Map/ranking/selection policies and hashes; ordered event versions; core/supporting/context claims; authority verdict/evidence-set hashes; entity/participation edges; date/display/uncertainty; coverage/omission resolutions; pre-lock Quality and Source Authority; view/membership IDs; writer constraints.

SHA-256 the canonical JSON of every meaning-bearing ordered ID, policy, version, constraint, and verdict. Exclude irrelevant timestamps/retry/storage paths. ID = corpus/topic/generation + lock hash.

Any fact/date/evidence/scope/membership/policy change creates a new lock and invalidates the pointer; old locks/writers remain. No writer enqueue without a fresh verifier proving references/hashes, count, EVENT-only spine, coverage, boundaries, and authority.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-LOCK-001`.

## 15. Phase 8 — Constrained writer and prose check

The writer input builder may resolve only the lock, allowed claim renderings, uncertainty, timeline context, and style. Static dependency tests prohibit acquisition/search/broad corpus/rejected candidate/Wikipedia imports.

Output retains the locked schema: public title; summary sentence units; exact event version/ordinal/title/description sentence units; transitions; writer policy/model execution/lock/payload hash. Every factual/interpretive sentence declares claim IDs.

Deterministic checks detect event/order changes, new dates, numbers/units, quotation drift, actor additions, certainty strengthening, forbidden causation, and missing claim refs. The semantic checker extracts all assertions and may map only to declared allowed claims.

New facts, stronger certainty, unsupported causation/interpretation, or actor conflation yield `PROSE_CLAIM_MISMATCH`; changed dates/quantities/quotes or missing refs yield `WRITER_CONTRACT_VIOLATION`. At most two prose-only repairs use the same lock. Missing history returns upstream; the writer never repairs history.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-WRITER-001`, requiring zero unsupported assertions in adversarial fixtures and independent review of the five regression topics.

## 16. Phase 9 — Institutional integration and Timeline View authority

| Institution | Minimal adapter | Must not change |
|---|---|---|
| Governance | V2 package/verifier maps event/entity/claim/evidence versions into canonical envelope; technical refs are lineage only | no fact creation/prose repair/bypass |
| Historical Library | after approval, create/adopt stable heads and immutable admitted versions | no candidate admission or old Memory mutation |
| Published Memory | exact admitted authority refs plus hash-bound technical refs sufficient for replay | no in-place rewrite |
| Projection | verify view/writer refs match admitted versions, materialize current DTOs | no membership invention/authority creation |
| Search/Sitemap | consume unchanged projections | no candidate queries |
| Public API/UI | no initial contract change | no V2 Production Memory exposure |

Canonical facts/claims enter the authority envelope. View Specification, Memberships, Lock, Writer, and Prose Check remain Factory technical artifacts outside Governance authority mapping. Package and Published Memory preserve exact IDs/hashes. Projection proceeds only when every membership event and sentence claim is admitted and all hashes/policies recompute.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-INSTITUTIONAL-001`. Tests prove V1 readability, shadow delivery rejection, synthetic emulator traversal, exact replay, and public DTO compatibility.

## 17. Phase 10 — Shadow mode

Use real Vertex/Grounding, active-corpus `v2*` Production Memory, one dedicated `factory-v2-shadow` queue/function, and a shadow service account with no institutional permission. Every artifact has `publicationEligible:false`, `governanceSubmissionAllowed:false`, `executionMode:SHADOW`. Governance preview creates no packages/queues/decisions. Shadow writes no existing Factory/Governance/Library/Memory/projection/search/sitemap/taxonomy/public collections.

Mandatory subjects: World Wide Web, Berlin Wall, Apollo 11, Cuban Missile Crisis, Apollo 13. They start as controlled shadow descriptors—not production requests or ledger replays.

Persist runtime/stage latency; calls/retries/repairs/tokens/queries; discovered/retrieved/limited/rejected sources and cache hits; claims by state; conflicts; entities/events/reuse; candidates/selected; completion/substitutions; locks; writer/checker repairs; unsupported assertions; Quality/Authority/Governance preview; bytes/Firestore operations/cost inputs.

Hard acceptance for every fixture:

- zero unsupported assertions/fabricated citations/non-event entries/silent scope expansion/fabricated precision;
- zero unresolved material conflicts in routine preview;
- 100% selected events pass claim burden;
- 100% public assertions map to approved claims;
- event count and phase/dimension coverage pass;
- no known major omission unresolved;
- all hashes reconstruct;
- zero writes outside shadow storage.

Reader review of scope, chronology, significance, omissions, redundancy, clarity, uncertainty, and title fulfillment is mandatory. Tests alone cannot certify.

Phase certificate: `TL-KNOWLEDGE-FACTORY-V2-SHADOW-001`. All five regressions plus at least 25 heterogeneous topics (all topic classes, non-Western/non-English evidence, contested quantities, sparse evidence) must pass.

## 18. Cost model

Do not state currency until measured usage and configured rates exist.

```text
topic cost = model input + model output + grounded queries + URL context
           + Firestore operations/storage + Functions/Tasks compute
           + Cloud Storage/OCR/extraction
```

| Stage | Best/reuse-heavy | Normal | Difficult/budget-bound |
|---|---:|---:|---:|
| Scope | 1 | 1 | 1 + 1 repair |
| Map/query plan | 2 | 2 | 2 + 2 repairs |
| Orientation | 0–1 grounded | 1 | 1 |
| Acquisition/authority | 0–1 grounded | 3–4 | 4 |
| Extraction | 0–2 chunks | 3–6 | 8–12 |
| Claim/conflict | 1–2 | 3–5 | 6–10 |
| Entity/event resolution | 1–2 | 2–4 | 5–8 |
| Selection | 1 | 2–3 | 4–6 |
| Completion | 0 | 1 | 2 grounded |
| Writer/check | 2 | 2–3 | 4–6 |
| Grounded total | 0–2 | 4–6 | hard max 7 |
| Model executions | ~7–12 | ~16–25 | ~30–47 |

Primary drivers: grounded queries, long-document extraction, candidate comparison, conflicts, and prose repairs. Instrument execution tokens, queries, version/location, latency, retries/repairs, cache, bytes, Firestore operations, compute, and allocation to attempted/published topic. Shadow data establishes best/normal/difficult actual percentiles.

## 19. Latency and Cloud Tasks topology

| Phase | Normal | Parallelism |
|---|---:|---|
| Scope/recon/map/plan | 60–120s | bounded recon |
| Orientation/acquisition | 90–180s | 3 grounded |
| Retrieval/extraction | 90–180s | 6 retrieval, 3 extraction |
| Claims/conflicts | 60–120s | 3 claim batches |
| Entity/event | 60–120s | entity groups; event waits |
| Selection | 45–90s | 2 comparison batches |
| Completion | 0–180s | 2 gap groups |
| Lock/writer/check | 90–180s | sequential after lock |
| Final gates | 15–45s | deterministic |

Normal expected total is 7–10 minutes. The p95 <12-minute target is realistic only with caching, bounded concurrency, checkpoint tasks, and batched—not per-source—model work. Difficult cases stop or review by 20 minutes.

Keep existing priority, autonomous, and institutional queues. Add exactly one V2 shadow queue for Phases 1–10; no per-stage queues. V2 uses multiple checkpoint deliveries on the mode/origin queue:

```text
scope-map -> acquisition -> claims -> resolution-selection
-> completion-lock -> writer-final
```

Task ID: `{corpus}-{topic}-g{generation}-v2-{stage}-{inputHashPrefix}`. Payloads contain IDs/hashes only. Completed checkpoints are reused on at-least-once delivery. Stale corpus/generation/mode/policy/lease is acknowledged without work. Cross-stage retry never repeats completed expensive calls. At Phase 11, the orchestrator uses the existing priority queue; autonomous stays paused; institutional remains unchanged except the adapter.

## 20. Version compatibility

Every artifact has ID/type/schema version/policy versions/prompt version/model execution/input IDs+hashes/payload hash/corpus/topic/generation/mode/immutable/time.

- readers declare supported schema ranges and exact policies;
- newer policy never silently reads old artifact;
- re-evaluation creates a linked new artifact;
- unknown major schema fails closed;
- minor additive forward compatibility must be declared;
- prompt/model change always creates new execution provenance;
- package/lock use exact versions, never `latest`;
- V1/V3 remain on frozen adapters.

## 21. Failure and review model

Failure categories are operationally disjoint:

- **Provider/infrastructure:** timeout, 429/5xx, lease loss, transient network/storage failure, or malformed transport envelope. Cloud Tasks may retry only an idempotent checkpoint with identical input; maximum three provider attempts under existing task age/backoff limits. A successful but historically inadequate response is not an infrastructure failure.
- **Historical knowledge:** insufficient/conflicting evidence, unresolved identity, impossible coverage, or an invalid scope/map. It consumes semantic-repair/research budgets, never infrastructure retries.
- **Editorial quality:** selection, writer, or prose output violates an already valid historical lock. It permits only the bounded deterministic or prose repair stated below.
- **Authority/evidence:** publisher/source/claim burden or Governance cannot admit the assertion. It fails closed and cannot be repaired by prose.

Every failure atomically writes immutable `v2FailureRecords`, advances the Topic Ledger, and refreshes `v2TopicOperations`. `AUTO` means the listed bounded action occurs without a person; `HUMAN` means no task remains queued. A terminal failure preserves all negative evidence and releases the generation ownership lease.

| Failure | Stage; class | Same artifact / research | Automatic disposition | Completion / substitution / scope | Human; terminal; Ledger | Alert; audit artifact |
|---|---|---|---|---|---|---|
| `SCOPE_AMENDMENT_REQUIRED` | scope or any downstream boundary check; historical/editorial | old scope remains immutable but cannot govern new work; research forbidden until new scope | non-retryable; deterministic minor amendment only for pre-enumerated normalization, max 1 | no completion/substitution; new scope version required | HUMAN for material amendment; terminal only if rejected/invalid; `AWAITING_SCOPE_REVIEW` | warning, critical if discovered after lock; failure + amendment proposal + invalidation record |
| `RESEARCH_MAP_INCOMPLETE` | map; historical | reuse locked scope; no acquisition research | max 2 new semantic executions; schema normalization deterministic | no completion/substitution; scope amendment only when omission is boundary-caused | HUMAN after exhaustion; terminal if map cannot be made valid; `AWAITING_RESEARCH_REVIEW` | warning; failure + validation report + execution refs |
| `ACQUISITION_BUDGET_EXHAUSTED` | acquisition/completion; historical | reuse all durable artifacts; new research forbidden automatically | non-retryable at exhausted budget; no repair | no further completion/substitution; scope amendment only if scope is infeasible | HUMAN; terminal when no approved budget/scope path; `AWAITING_RESEARCH_REVIEW` | budget warning; failure + budget ledger + unresolved-question set |
| `SOURCE_IDENTITY_UNRESOLVED` | durable retrieval; authority/evidence | reuse discovery record, not an unresolved source as evidence; alternative retrieval allowed within original budget | max 2 identity resolutions per source; deterministic canonicalization allowed | targeted acquisition yes within budget; substitution not yet applicable; no scope change | HUMAN if material source remains; terminal only when required authority unavailable; `AWAITING_SOURCE_REVIEW` | warning; failure + retrieval/redirect/DNS identity trace |
| `SOURCE_AUTHORITY_INSUFFICIENT` | claim authority; authority/evidence | reuse source/snapshot/verdict; new targeted research permitted only by completion budget | no model retry on same evidence; one deterministic burden recompute after new evidence | completion yes; selected-event substitution max 2; no scope amendment unless topic burden is infeasible | HUMAN after completion/substitution; terminal if essential burden fails; `AWAITING_AUTHORITY_REVIEW` | high warning; failure + verdict/evidence-set/gap artifact |
| `CLAIM_UNSUPPORTED` | claim assessment; authority/evidence | reuse rejected claim version for audit only; targeted research only for selected material claim | no retry on unchanged evidence; deterministic reject | completion yes for selected gap; substitution max 2; scope amendment no | HUMAN only if claim is essential/material after bounds; otherwise event removed; terminal if essential unresolved; `AWAITING_EVIDENCE_REVIEW` or continues | warning when material; failure + rejected claim/version/verdict |
| `CLAIM_CONFLICT_UNRESOLVED` | conflict resolution; historical/authority | reuse claim/evidence/conflict set; one targeted conflict inquiry allowed | max 1 new semantic assessment after new evidence; deterministic conflict grouping allowed | completion yes within global cap; substitution max 2; no scope amendment normally | HUMAN mandatory for sensitive/material conflict; terminal if essential unresolved; `AWAITING_CONFLICT_REVIEW` | high/Severity-1 if published-bound; failure + conflict set + authority decisions |
| `ENTITY_IDENTITY_REVIEW_REQUIRED` | entity resolution; historical | reuse candidates; no broad research, one named-identity lookup within acquisition budget | no repeated adjudication on same candidates; deterministic exact-ID/alias match only | completion only for named identity evidence; no event substitution/scope amendment | HUMAN; nonterminal while distinct; terminal if essential identity cannot be stated safely; `AWAITING_IDENTITY_REVIEW` | warning; failure + candidate set + adjudication execution |
| `EVENT_IDENTITY_REVIEW_REQUIRED` | event resolution; historical | reuse claim cluster/candidates; no broad research | no retry on unchanged cluster; deterministic non-merge allowed | targeted evidence only for exact identity gap; substitution later, not here; no scope change | HUMAN; nonterminal while separate candidates are safe; terminal if essential event ambiguous; `AWAITING_EVENT_REVIEW` | warning; failure + cluster + merge/split proposal |
| `COVERAGE_GAP_MATERIAL` | selection; editorial/historical | reuse ranking and passing candidates; no new research until substitution exhausted | one deterministic selection rerun | completion yes only after substitutions; max 2 substitutions; scope amendment if coverage impossible | HUMAN after bounds; terminal if required coverage impossible; `AWAITING_EDITORIAL_REVIEW` | high warning; failure + coverage matrix + omission report |
| `EVENT_LIMIT_UNSATISFIABLE` | selection; editorial | reuse ranking; research forbidden | one deterministic redundancy/granularity evaluation | no completion/substitution unless a passing ranked alternative resolves it; scope amendment required if still >20 | HUMAN; terminal if amended scope rejected; `AWAITING_SCOPE_REVIEW` | warning; failure + selection proof + proposed scope/granularity change |
| `LOCK_INTEGRITY_FAILED` | lock build/verify; provider/infrastructure if transient, otherwise integrity | never reuse invalid lock; reuse verified upstream versions | max 3 identical storage transactions; one deterministic reconstruction | no research/completion/substitution/scope change | HUMAN and terminal for generation if reconstruction differs; `FAILED_INTEGRITY` | critical/Severity-1; failure + recomputation proof + invalidation record |
| `WRITER_CONTRACT_VIOLATION` | writer validation; editorial | reuse same lock; never reuse invalid prose | max 2 prose-only executions; deterministic formatting repair allowed only when meaning-neutral | no research/completion/substitution/scope change | HUMAN after two; terminal for generation if rejected; `AWAITING_EDITORIAL_REVIEW` | warning; failure + writer artifact + validator diff |
| `PROSE_CLAIM_MISMATCH` | prose claim check; editorial/authority | reuse same lock and allowed claims; invalid prose audit-only | max 2 prose-only executions; deterministic removal allowed only when sentence removal preserves contract | no historical repair; no completion/substitution/scope change | HUMAN after two or return to a new upstream generation; terminal for current generation; `AWAITING_EDITORIAL_REVIEW` | high warning; failure + extracted assertions + mismatch map |
| `GOVERNANCE_REVIEW_REQUIRED` | Governance adapter/preview; authority | reuse immutable package; new research forbidden unless Governance rejects a specific claim into a new generation | non-retryable; no deterministic authority repair | none in same generation; no substitution/scope amendment | HUMAN mandatory; live `AWAITING_REVIEW`, shadow `SHADOW_REVIEW_REQUIRED`; not terminal until decision | high warning; failure + package + Governance reason/preview |

Unclassified semantic exceptions fail as `FAILED_UNCLASSIFIED` with a critical alert and immutable diagnostic until the taxonomy is amended. They are never converted to provider retry. An alert contains corpus/topic/generation, origin, stage, class, severity, elapsed time, exact blocking artifact IDs, attempts/budgets, and runbook link; it contains no secrets or raw copyrighted bodies.

### 21.1 Founder/Admin operations read model

`v2TopicOperations` is a rebuildable backend projection, never workflow authority. The checkpoint transaction updates authoritative stage state first and then an outbox marker; an idempotent projector renders the read model. Founder/Admin APIs read it through authenticated, role-checked, cursor-paginated endpoints with a default 50 and hard 200-item limit. They never scan artifact collections or expose source bodies/model prompts.

Each row exposes topic/title, generation, origin, pipeline/mode, authoritative Ledger state, current stage, stage start/elapsed/last heartbeat, scope status, research questions complete/blocked, sources discovered/retrieved by class, claims accepted/rejected/conflicted, canonical events reused/created/discovered, provisional/selected/substituted counts, completion/lock/writer/prose/Quality/Authority/Governance/publication states, cost units and configured budget, Vertex/grounding calls, provider retries/semantic repairs, and exact blocking class/reason/artifact link. Aggregates are bounded counters written during processing, not live collection scans.

Required backend contracts:

- `GET /api/admin/factory-v2/topics?state=&origin=&stage=&cursor=&limit=` returns sanitized rows and `asOf`;
- `GET /api/admin/factory-v2/topics/{topicId}/generations/{generation}` returns the stage timeline and authorized artifact metadata;
- `GET /api/admin/factory-v2/alerts?severity=&cursor=&limit=` returns unresolved operational alerts;
- every response is strict-schema validated, tenant/corpus scoped, cache-control private/no-store, audited, and rate limited;
- projection lag >60 seconds while work is active raises `OPERATIONS_PROJECTION_STALE`; the API labels stale data and never invents current state.

Public users receive only a derived lifecycle from Topic Ledger/institutional state:

| Public state | Authoritative derivation |
|---|---|
| `REQUESTED` | accepted Ledger generation has not begun scope work |
| `RESEARCHING` | scope through evidence completion is active |
| `PREPARING` | resolution through prose/quality gates is active |
| `UNDER_REVIEW` | any human review or Governance state is pending |
| `PUBLISHED` | Published Memory and public projection both verify the generation |
| `UNABLE_TO_COMPLETE` | terminal failure after sanitization; no internal reason/source details |

This mapping is a pure server-side function over authoritative state. It creates no second state machine and requires no UI work in this program.

## 22. Phase 11 — Live certification and priority cutover

Separate Founder authorization is required.

1. Prove all Phase 0–10 certificates current.
2. Inventory public/Memory/ledger/review/task/revision/scheduler/error baseline.
3. Keep autonomy paused.
4. Hold new priority generation as `PENDING_V2`; drain V1 in-flight without touching review items.
5. Deploy `LIVE_CERTIFICATION`; keep general priority held.
6. Prove unauthenticated workers/institutional return forbidden.
7. Submit exactly one new authorized, pre-checked topic through real priority intake.
8. Allow natural progress without replay/edit/direct transition/regeneration.
9. Audit lineage, reader quality, security, cost, latency, API/search/sitemap/rendering.
10. Failure preserves evidence and restores/holds intake per rollback; no retry without new authorization.
11. Success atomically pins new User/Admin generations to V2 and releases held requests.

Certificate: `TL-KNOWLEDGE-FACTORY-V2-LIVE-001`. One live pass proves viability, not autonomous trust.

### 22.1 Preserved exceptional-review evidence

Cuban Missile Crisis and Apollo 13 remain immutable failed historical Production Memory and certification fixtures. They are never advanced, edited, replayed, or used as the live certification request. After `LIVE-001`, Founder/Admin may submit each topic through normal V2 intake; each receives a new generation, V2 ownership tuple, Scope Contract, and independent institutional path.

Compatible durable source snapshots may be referenced only when source identity, content hash, access record, extractor version, and V2 policy compatibility all verify. Existing claims/verdicts remain legacy hints and must be re-extracted/re-adjudicated. A successful V2 publication may explicitly supersede the failed generation in lineage without deleting it. The original package, failure reasons, review state, negative evidence, and audit hashes remain reconstructable forever.

## 23. Trust metrics and autonomous readiness

No aggregate trust score.

Primary safety metrics—unsupported assertions, fabricated citations, non-events, scope expansion, precision fabrication, routine unresolved conflicts, selected-event burden failures, duplicate events, reader false-positive passes, material corrections—must all remain zero.

Operational metrics: routine/human-review, completion/substitution, claim rejection, authority escalation, scope amendment, event reuse, cost, p50/p95 latency, retries/leases/cache/backlog. They diagnose capacity and never override safety.

Autonomous resumption may be considered only after:

- `AUTHORITY-001`, `PRIMITIVES-001`, `ACQUISITION-001`, `CLAIMS-001`, `RESOLUTION-001`, `SELECTION-001`, `COMPLETION-001`, `LOCK-001`, `WRITER-001`, and `INSTITUTIONAL-001` are current;
- 30 heterogeneous shadow topics including five regressions pass hard gates and reader review;
- `LIVE-001` passes;
- at least 10 subsequent monitored V2 User/Admin publications cover supported topic classes represented by demand;
- primary safety metrics remain zero;
- p95 standard topic <12 minutes and no silent >20-minute run;
- actual cost instrumentation and budget enforcement pass;
- no unresolved Severity-1 content-integrity defect exists;
- exceptional-review observability is operational, backlog is within explicitly approved reviewer capacity, and suppression is certified;
- rollback/recovery rehearsed;
- Founder explicitly authorizes resumption.

Release is staged, not binary:

| Stage | Limit | Minimum observation before promotion |
|---|---:|---|
| A | 1 autonomous publication per rolling 24 hours | 14 consecutive days and at least 10 completed autonomous attempts |
| B | 3 per rolling 24 hours | 30 consecutive days and at least 30 additional completed attempts |
| C | configuration-capped volume approved by Founder | 30 additional days and capacity/load certificate at proposed cap |

Every window requires zero primary safety defects, zero unresolved Severity-1 defects, 100% assertion-to-approved-claim mapping, 100% selected-event burden pass, p95 <12 minutes for standard topics, no silent >20-minute run, budget compliance, successful rollback drill, reader sampling of at least 20% and at least five publications, and exceptional backlog below 50% of measured weekly reviewer capacity. Any primary defect, rollback failure, or backlog at capacity immediately pauses discovery and returns to Founder review. Routine pass rate is observed; a low rate blocks promotion when measured reviewer capacity would be exceeded. Limits are configuration, never hard-coded, and changing them is audited.

## 24. Certification matrix and deliverables

| Phase | Certificate / proof |
|---|---|
| 0 | `AUTHORITY-001`: authority diff, vocabulary/link tests, human review |
| 1 | `PRIMITIVES-001`: schemas/repositories/indexes/IAM/migration/rollback/isolation |
| 2 | `ACQUISITION-001`: real Grounding, safe retrieval, formats, budgets, lineage |
| 3 | `CLAIMS-001`: predicates/types/risks/conflicts/independence/Wikipedia |
| 4 | `RESOLUTION-001`: identity/reuse/merge-split/uncertainty/bounded queries |
| 5 | `SELECTION-001`: 30/50/100 stability, coverage, omissions, max 20 |
| 6 | `COMPLETION-001`: search/query/substitution limits and failure routes |
| 7 | `LOCK-001`: reconstructed hash, invalidation, no writer without pass |
| 8 | `WRITER-001`: boundary, adversarial prose, zero unsupported claims |
| 9 | `INSTITUTIONAL-001`: legacy readability, synthetic traversal, DTO replay |
| 10 | `SHADOW-001`: 30 subjects, metrics, readers, zero public writes |
| 10 | `RELIABILITY-001`: measured cost/load/latency, backpressure, recovery |
| 11 | `LIVE-001`: one separately authorized untouched live publication |
| 12 | monitored-priority report, trust metrics, recovery, explicit autonomy decision |

Every implementation phase also passes applicable root/functions tests, typecheck, lint, builds, dependency audits, and existing institutional suites without weakening. Automation is necessary, never sufficient.

## 25. Ordered implementation work packages

Each goal is a separate reviewable change. “Deploy” means a future explicitly authorized nonproduction or production deployment; this roadmap performs none. Every goal preserves earlier certificates and may be reverted at its stated boundary without deleting immutable evidence.

| Goal | Objective and dependencies | Likely files; collections/indexes; model calls | Production/deploy and rollback | Tests, gate, definition of done |
|---|---|---|---|---|
| `TL-KF-V2-000` | Reconcile authority vocabulary/ownership. Depends: roadmap approval. | Authority/Knowledge/Factory docs only; none; none. | No production, no deploy; revert doc commit. | Link/vocabulary/authority diff + human review; `AUTHORITY-001`; all contradictions in §5 resolved. |
| `TL-KF-V2-001` | Build strict envelopes, hashes, repositories, indexes, config, leases, failure and operations primitives. Depends: 000. | `functions/src/factory-v2/contracts`, `repositories`, `config`; all Phase-1 collections and `firestore.indexes.json`; none. | Default `OFF`, emulator first; nonproduction deploy later; kill switch/revert revision. | Schema/hash/idempotency/index/size/IAM/emulator/legacy-isolation tests; `PRIMITIVES-001`; no existing repository imports V2. |
| `TL-KF-V2-002` | Scope Contract, reconnaissance boundary, Research Map and Query Plan. Depends: 001. | `scope`, `research-map`; scope/map/query/execution collections; `scope_proposal`, `research_map`, `query_plan`. | Shadow-only deploy; disable stages, retain artifacts. | Golden/adversarial scope/map, schema repair/budget/invalidation tests; `SCOPE-MAP-001`; deterministic accepted contracts persisted. |
| `TL-KF-V2-003` | Search-role orchestration, safe durable retrieval, extraction, deduplication. Depends: 002. | `acquisition`, `retrieval`; query/acquisition/source/snapshot/segment/execution indexes; orientation/map/authority search, URL extraction. | Shadow-only; queue pause + feature flag. | SSRF/redirect/size/format/paywall/cache/dedup/lineage/real-provider fixture tests; `ACQUISITION-001`; all URLs end durably retrieved, limited, rejected, duplicate, or failed. |
| `TL-KF-V2-004` | Atomic claim extraction, predicates, evidence selectors/edges and conflicts. Depends: 003. | `claims`; atomic claim/version/evidence/conflict/execution collections; claim extract + semantic assess. | Shadow-only; disable claim enqueue. | Exact-span, dates/units/quotes, granularity, unsupported/conflict, idempotency tests; `ATOMIC-CLAIMS-001`; every accepted claim has reconstructable evidence. |
| `TL-KF-V2-005` | Publisher Registry and claim-level Source Authority adaptation. Depends: 004. | `source-authority-v2`, adapter to `source-authority.ts`; publisher/verdict/source indexes; authority search + semantic assess. | Shadow-only; V1 authority unchanged; revert adapter/config. | registry versioning, source class, independence, risk burden, Wikipedia prohibition, five-fixture comparisons; `CLAIMS-001`; no claim passes an unmet burden. |
| `TL-KF-V2-006` | Canonical entity resolution and alias/external-ID reuse. Depends: 004–005. | `entities`; entity/version/alias indexes; entity adjudicate. | Shadow-only; disable stage. | multilingual aliases, collisions, external IDs, bounded lookup, merge/split/review tests; `ENTITY-001`; stable candidate identities persisted. |
| `TL-KF-V2-007` | Canonical event resolution, relations, reuse and revalidation. Depends: 006. | `events`; event/version/claim/entity/relation indexes; event adjudicate. | Shadow-only; no Library admission; disable stage. | same-day/process/state/uncertainty/reuse/false-neighbor/bounded-query tests; `RESOLUTION-001`; immutable event candidates reconstruct. |
| `TL-KF-V2-008` | Comparative significance, coverage matrix, deterministic selection/view membership. Depends: 007. | `selection`; ranked/coverage/view/membership indexes; significance compare. | Shadow-only; revert policy version. | 30/50/100 stability, phase/dimension, boundary, omission, redundancy, max-20 tests; `SELECTION-001`; ranking and selection replay byte-identically. |
| `TL-KF-V2-009` | Bounded evidence completion and event substitution. Depends: 008. | `completion`; gap records within acquisition/claim/event artifacts; completion search + existing claim/authority calls. | Shadow-only; budget flag zero disables. | 2-call/12-query/2-substitute caps, essential failure/conflict/independence tests; `COMPLETION-001`; no unbounded loop. |
| `TL-KF-V2-010` | Immutable Locked Event Skeleton and invalidation. Depends: 009. | `lock`; locked-set index; none. | Shadow-only; disable writer handoff. | canonical hash/reference/policy/count/coverage/invalidation/concurrency tests; `LOCK-001`; recomputation matches and invalid locks cannot enqueue. |
| `TL-KF-V2-011` | Constrained writer, sentence-to-claim declarations, prose claim checker. Depends: 010. | `writer`, `prose-check`; writer/check collections; writer + prose claim extract. | Shadow-only; disable writer; old artifacts retained. | dependency-boundary, dates/quantities/quotes/actors/causation/repair-limit/adversarial tests; `WRITER-001`; zero unsupported assertions. |
| `TL-KF-V2-012` | Governance/Library/Memory/Projection adapters and unchanged public DTOs. Depends: 011 and 000. | `institutional-adapters`; existing institutional modules only behind flags; no new model calls. | Emulator then shadow preview; no live delivery; adapter flag off/revert. | V1 readability, forbidden shadow delivery, synthetic traversal, exact replay, DTO/API/search/sitemap tests; `INSTITUTIONAL-001`; authority never moves to technical artifacts. |
| `TL-KF-V2-013` | Checkpoint orchestration, operations read model, alerts, shadow run of five regressions +25 topics. Depends: 002–012. | `orchestrator`, `operations`, admin API; task/failure/operations indexes; all certified calls. | Dedicated shadow deploy required; no institutional IAM; kill switch + queue pause. | stale-task/lease/outbox/read-model/RBAC/rate-limit plus reader rubric; `SHADOW-001`; 30 topics meet zero-defect gates. |
| `TL-KF-V2-014` | Cost, latency, load and recovery certification. Depends: 013. | instrumentation/config/runbooks; execution/operations indexes; no new semantic call. | Shadow load deploy; bounded quotas; disable load producer. | p50/p95, <12/<20 targets, budgets, backpressure, retry storm, restore/rollback drills; `RELIABILITY-001`; approved measured limits recorded. |
| `TL-KF-V2-015` | One genuine live priority certification. Depends: 000–014 and separate Founder authorization. | mode/adapter config and certification record; existing priority/institutional paths; certified calls only. | Production deployment/request required later; general intake held; rollback to `HOLD`/prior revision. | baseline/delta, IAM, full lineage, readers, API/search/sitemap, cost/latency; `LIVE-001`; exactly one untouched request passes naturally. |
| `TL-KF-V2-016` | Transactional priority cutover, monitored publications, exceptional-generation path, autonomous staged release. Depends: 015. | config/ledger/tasks/operations/runbooks; no schema novelty; certified calls only. | Production config/deploy required later; switch to `HOLD` or current pipeline for new generations, never rewrite active work. | mixed-version/duplicate/stale-task/cutover/recovery/ramp-pause tests and observation gates; `CUTOVER-001`; new priority generations use V2 and autonomy remains paused until separately authorized. |

The exact next goal is `TL-KF-V2-000 — Authority Reconciliation`. It changes only the contradictory authority documents listed in §5 and produces `TL-KNOWLEDGE-FACTORY-V2-AUTHORITY-001`. It must not implement schemas or runtime behavior.

## 26. Rollback strategy

Each package has four mandatory controls: default-off flag, prior deploy revision/config snapshot, immutable audit evidence, and a rehearsed disable path. Schema changes are additive; rollback stops writers/readers but never drops collections or indexes. Model/policy rollback creates new executions under an approved prior bundle; it never relabels artifacts. Task rollback pauses the affected queue/stage, rejects stale epochs as `STALE_NOOP`, and resumes only pinned compatible tasks. Cutover rollback holds new intake, restores the prior pipeline only for new generations, lets safe pinned work finish or explicitly cancels it, and never mutates Published Memory. Institutional rollback disables the V2 adapter before any queue resumes. Recovery success is verified by corpus hashes, queue/task inventory, Topic Ledger ownership, public DTOs, search/sitemap, and absence of cross-mode writes.

## 27. Remaining risks

| Risk | Control | Implementation blocker? |
|---|---|---|
| Authority contradictions in §5 | Complete `TL-KF-V2-000` before runtime work | Yes, for `TL-KF-V2-001+` |
| Real Grounding attribution and URL durability vary | real-provider fixtures, durable retrieval, fail-closed evidence identity | No for 000; gate for acquisition |
| Firestore fan-out/index/document limits | edge collections, bounded queries, size tests, offload | No; validate in 001 |
| Semantic identity/selection instability | bounded candidates, persisted comparisons, human review, replay tests | No; gates 006–008 |
| Sparse/non-English/contested evidence | heterogeneous fixtures and authority burdens | No; may route individual topics to review |
| Cost/latency estimates are unpriced assumptions | measured shadow instrumentation before live | No; gate 014 |
| Founder review capacity unknown | measure throughput; keep autonomy paused; capacity-based backlog threshold | No; gate 016 |
| Exceptional legacy evidence compatibility | immutable negative evidence and explicit V2 revalidation | No |
| Provider/model version retirement | exact version pinning and mandatory recertification | No; operational release risk |

## 28. Implementation go/no-go decision

**FACTORY V2 IMPLEMENTATION: GO.**

The architecture is sufficiently specified for the first documentation-only implementation goal. This is not a GO for runtime implementation, deployment, production requests, cutover, or autonomy. Runtime work remains blocked until `TL-KF-V2-000` resolves §5 and issues `AUTHORITY-001`; each subsequent package requires its predecessor certificates.

## 29. Roadmap definition of done

This roadmap is complete when the locked design and both supplied request segments are represented by: reconciled prerequisites; owned/persisted primitives; additive graph-over-Firestore migration; classified reuse; bounded model/search/retrieval contracts; deterministic validation after every semantic stage; atomic claims/authority/entity/event/reuse/selection/completion/lock/writer/prose contracts; preserved institutional authority; shadow fixtures and reader gates; cost/latency/task/version/failure/observability/rollback/cutover contracts; conservative autonomous release; independently certifiable work packages; and the explicit conditional GO above.

Completion of this roadmap changes no runtime or production state. Completion of Factory V2 itself requires all certificates through `LIVE-001`, monitored V2 User/Admin publications, preserved V1/V3 readability, reconstructable regression/heterogeneous results, proven rollback, and a separate decision on autonomous discovery.

## 30. Executive matrix and final verdict

| Area | Decision | Implementation phase | Primary risk | Certification gate |
|---|---|---:|---|---|
| Authority reconciliation | Resolve named contradictions first; no authority movement | 0 | conflicting doctrine | `AUTHORITY-001` |
| Firestore graph | additive corpus-scoped `v2*` nodes/edges | 1 | index/size/fan-out | `PRIMITIVES-001` |
| Scope Contract | immutable, versioned boundary before research | 2 | silent expansion | scope component gate |
| Research Map | question/phase/dimension plan, not equal buckets | 2 | omissions | map component gate |
| Source acquisition | five bounded search roles | 2 | retry/cost expansion | `ACQUISITION-001` |
| Durable retrieval | identity/access/hash/extract before evidence | 2 | SSRF, inaccessible content | `ACQUISITION-001` |
| Atomic Claims | typed atomic versions with exact evidence edges | 3 | compound/unsupported claims | `CLAIMS-001` |
| Source Authority | claim-risk burden using versioned publisher/source facts | 3 | weak or dependent evidence | `CLAIMS-001` |
| Entity resolution | exact IDs/aliases then bounded semantic adjudication | 4 | false merge | `RESOLUTION-001` |
| Canonical events | claim-backed immutable candidates; EVENT spine | 4 | wrong granularity/identity | `RESOLUTION-001` |
| Event reuse | admitted heads first; targeted revalidation only | 4 | stale authority | `RESOLUTION-001` |
| Significance/coverage | comparative model judgment + deterministic solver | 5 | unstable selection/omission | `SELECTION-001` |
| Evidence completion | two calls, twelve queries, two substitutions | 6 | search-until-success | `COMPLETION-001` |
| Event lock | canonical exact-reference hash and invalidation | 7 | stale/mixed facts | `LOCK-001` |
| Constrained writer | only locked claims/context; no research access | 8 | invented facts | `WRITER-001` |
| Prose claim check | assertion extraction against allowed claims; two repairs | 8 | semantic drift | `WRITER-001` |
| Governance integration | adapter preserves authority; technical view refs remain noncanonical | 9 | silent authority movement | `INSTITUTIONAL-001` |
| Shadow mode | dedicated IAM/queue/storage, real providers, 30 readers-reviewed topics | 10 | false confidence from tests | `SHADOW-001` |
| Live certification | one separately authorized natural priority request | 11 | production integrity | `LIVE-001` |
| Autonomous discovery | staged 1/day then 3/day then measured cap | 12 | scaling review defects | monitored ramp + Founder authorization |

**FACTORY V2 IMPLEMENTATION: GO.**

**NEXT CODEX GOAL: `TL-KF-V2-000 — Authority Reconciliation`. DO NOT IMPLEMENT IT AS PART OF THIS ROADMAP GOAL.**

V2 may accumulate Factory Production Memory in shadow, but no V2 artifact may enter Historical Library or Published Memory until shadow certification passes and a separately authorized live certification runs without bypass, replay, manual advancement, or production-state repair.
