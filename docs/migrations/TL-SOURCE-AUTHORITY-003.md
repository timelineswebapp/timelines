# TL-SOURCE-AUTHORITY-003 — Live End-to-End V2 Publication Certification

Certification date: 2026-09-05

Branch: `codex/tl-content-reset-001`

Starting commit: `e86220c9da506efbd97753d7da5d95c14ab294a3`

Source Authority policy: `source-authority-v2.0.1-certified-2026-09-05`

Active corpus: `timelines-clean-2026-09-v1`

## Purpose and controls

This record covers exactly one genuine production priority request through the existing deployed intake, Factory, Timeline Quality, Source Authority V2, Governance, Historical Library, Published Memory, projection, search, public API, and public website path. No fixture, synthetic insertion, direct database publication, manual transition, evidence edit, source reclassification, regeneration, or certification bypass is permitted.

## Selected topic and pre-submission rationale

Selected topic: **The Apollo 11 Mission**

Canonical precomputed identity:

- Topic ID: `84007fa50a977eec8708ab8945f23fb6991b0e7b`
- Expected slug: `the-apollo-11-mission`
- Scope: `timelines-clean-2026-09-v1:en:timeline:the apollo 11 mission`

The topic is historically meaningful and tightly bounded to the July 16–24, 1969 mission. It was absent from production topic ledgers and public timeline read models at `2026-09-05T17:44:32.726Z`; searches for Apollo/Moon Landing aliases found no ledger or canonical public timeline.

It is appropriate for this certification because NASA provides definitive primary institutional records covering the mission objective, launch, translunar flight, lunar orbit, landing, surface activity, ascent/rendezvous, return, and splashdown. Independent Smithsonian institutional material covers the mission and its historical context. This makes the topic likely to satisfy the certified policy while still exercising exact claim relevance, publisher-parent independence, primary-source affinity, and risk-sensitive corroboration.

Representative pre-submission authority evidence:

- [NASA Apollo 11](https://www.nasa.gov/mission/apollo-11/)
- [NASA Apollo 11 Mission Overview](https://www.nasa.gov/history/apollo-11-mission-overview/)
- [NASA Final Apollo 11 Flight Plan](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11-fltplan.html)
- [Smithsonian: A Brief History of the Apollo Program](https://www.si.edu/newsdesk/factsheets/brief-history-apollo-program)

These pages are selection evidence only. Production research must independently discover and bind its own grounded evidence; this record does not inject or edit sources.

## Pre-run source-control and deployment state

- Working tree was clean before this record was created.
- Local HEAD and `origin/codex/tl-content-reset-001` both resolved to `e86220c9da506efbd97753d7da5d95c14ab294a3` (`0` ahead, `0` behind).
- Local and remote `main` both resolved to `36c0ba7bc587cc1f40caab20e203c596395241da`; main was not checked out or modified.
- `priority-topic-generation-00009-rex`: ACTIVE, 100% traffic.
- `autonomous-topic-generation-00009-ruq`: ACTIVE, 100% traffic.
- `institutional-transitions-00007-hop`: ACTIVE, 100% traffic.
- `timelines-public-api-00006-tey`: ACTIVE, 100% traffic.
- `topic-discovery-00005-qah`: ACTIVE, 100% traffic.
- Discovery scheduler: ENABLED, unchanged `0 3 * * *` UTC schedule.
- Priority, autonomous, and institutional Cloud Tasks queues: RUNNING.
- Exceptional-review backlog: 0; autonomous exceptional-review backlog: 0.
- Priority/institutional error-level Cloud Run logs during the preceding two hours: 0.
- Active-corpus pointer and registry: `timelines-clean-2026-09-v1`, `NO_LEGACY_CONTENT_REUSE`.

## Pre-run public baseline

| Timeline | Published Memory | Projection hash | Updated |
|---|---|---|---|
| The History of the World Wide Web | `6bb556f4ab0abcc305af55b7a9e83f51fbb79420--g1` | `51d932ec84b1d72a32dae2c30272d120c3e700c6423426905a10996c5611d900` | `2026-09-05T07:51:55.642Z` |
| The Fall of the Berlin Wall | `378338ba105ec8027857ae7fb72c3dd41baefff2--g1` | `5b4c0fac4421dab2eed160dba29058d41c3cfb611237a83677f2283e9f67b54b` | `2026-09-05T13:48:10.687Z` |

Pre-run public counts: 2 timeline read models, 2 Published Memory records, and 2 active publication-lifecycle records.

## Production execution

Submission mechanism: one `POST /api/timeline-requests` request to the production website, which used the deployed signed priority intake path. The response was `QUEUED`. No second request, manual advancement, replay, direct data edit, or regeneration was performed.

- Request ID: `8bad7a23-202d-40c9-b5ef-a6f124b134ed`
- Topic ID: `84007fa50a977eec8708ab8945f23fb6991b0e7b`
- Job/run ID: `4acb53bd-e242-4af8-9ca4-60e5c3c28e60`
- Deterministic task identity: `timelines-clean-2026-09-v1-84007fa50a977eec8708ab8945f23fb6991b0e7b-g1`
- Intake: `2026-09-05T17:46:44.477Z`
- Worker start: `2026-09-05T17:46:47.770Z`
- Publication: `2026-09-05T17:49:00.620Z`
- Intake-to-publication latency: 136.143 seconds
- Worker duration: 132.850 seconds
- Final ledger/job state: `PUBLISHED` / `published`, generation 1
- Cloud Task attempts: 1 of maximum 5; no retry and no last error
- Research: two grounded-search calls, one additional Vertex call, and one targeted authority repair call. The immutable repaired snapshot records 37 sources and 41 evidence segments.
- Model: `gemini-2.5-flash`, prompt `historical-research-v4.1-source-authority`, schema `generated-timeline-v2`

The targeted authority repair was a supported stage inside the same attempt. It was not a pipeline retry or a second candidate generation.

## Immutable institutional lineage

| Stage | Immutable identity/hash |
|---|---|
| Priority request | `8bad7a23-202d-40c9-b5ef-a6f124b134ed` |
| Initial research snapshot | `df213788ae2a66d1e1b085384dd1064ac956573a`, content `b1204f7c6e6cd0b1ba0a1788872ca901f5e73d4cc4bd7b47968318e96b5cb493` |
| Exact consumed/repaired snapshot | `273f499c55ad937c691b6a2cbe500e7723a12fda`, content `b3a5b8ee50d3c7b23b13005c52a1b4fd837d1eaaac3366247db3f4ac49dfe345` |
| Candidate timeline | `d91256c6772d84c6655f157386144f52a10f4d84`, payload `010b364785c03cd02f8a2fac982d312fa8781f53df7968226ddded1b058e5be4` |
| Timeline Quality | `9424a899086f00c7785c10aa8d401f3e2c684b4c`, payload `56d658e97f6a06cf300ec5df6e6c8d153cdfec8a3f9f92ca159313432a1fa473` |
| Source Authority V2 | `5fdeb79145a974c8b0dc6d931e9b1bf3db88ff6a`, payload `ff099085c877e6b41cdf0e4bbf4adc29139563f40ae6365224e31d50f5d0da95` |
| Governance package | `c05f286d-6c41-57d1-98c9-1d326ec90233` |
| Governance decision/approval/audit | `39fbbb9ecdc1bd534fb28149825e784624f4acca` / `b243cb52427f039b8d037359bb44f0102277f5b8` / `836a89686f5d2c12e783165f7c6cdadbb847cfbb` |
| Historical Library admission | `a9c2068d5d4b9afd05c03d5bc601e90a75ec4bb3` |
| Published Memory | `84007fa50a977eec8708ab8945f23fb6991b0e7b--g1`, authority `a8357c0465dec4f8009d841b4b87961048290c9e299880acab6439dc7d93959b` |
| Timeline projection | `timeline--the-apollo-11-mission`, `4d499f51c6ce8eaf8c70838032a05c5c3670846f68349da594131dce959ece09` |
| Public identity | ID `4000000003`, slug `the-apollo-11-mission` |

All three persisted payload hashes recomputed exactly. Published Memory contains the exact candidate payload, exact consumed source snapshot reference, exact Source Authority artifact reference, and exact policy version. The timeline projection hash recomputed exactly over the persisted read-model payload. The chain contains 38 evidence records, 38 claim links, and 38 corresponding immutable `PASSED` evidence validations.

## Source Authority V2 verification

The live artifact passed under exactly `source-authority-v2.0.1-certified-2026-09-05` with no unresolved source issues and no material conflict findings. Its diversity inventory records 25 publisher identities, six source classes, three primary sources, 18 secondary sources, and two Wikipedia sources across the broader snapshot.

The exact candidate snapshot includes NASA primary institutional evidence and independent scholarly/institutional corroboration including USRA, AIP, University of Hawaii, ESA, and AMNH material. Independence is keyed to publisher-parent identity, so multiple NASA URLs contribute one `nasa` group. Wikipedia evidence is classified `orientation` and does not satisfy authoritative burden. Weak/general-web sources remain supporting only. Every major milestone met the deterministic strong-source burden; the policy required a definitive primary source only where the claim classification made it appropriate. No unrelated prestigious source was counted as authoritative for an unrelated claim, and no weak disagreement produced a false conflict.

Governance did not recompute or bypass the assessment. Package `c05f286d-6c41-57d1-98c9-1d326ec90233` carried the immutable artifact, policy, verdict, exact source snapshot, exact quality artifact, and exact candidate reference; the downstream admission and Published Memory records preserved those references.

## Timeline Quality and editorial review

Automated Timeline Quality returned `passed` under `timeline-quality-v2-omission-semantics`. Its omission semantics correctly treated Kennedy's 1961 challenge and preceding Apollo missions as outside scope, continuous ground-support/global-viewership/cultural-impact topics as contextual non-events, and post-splashdown quarantine as inappropriate at standard granularity.

However, independent reader review found a substantive publication defect that invalidates this certification:

1. The declared closed-episode boundaries are January 9 through July 24, 1969, but the published candidate includes three state/legacy entries — `Command Module 'Columbia' on Display`, `Legacy of Scientific Instruments on Moon`, and `Ongoing Study of Lunar Samples` — with only the date `1969`.
2. These descriptions concern preservation and ongoing effects after the mission, not discrete events during the declared episode. They therefore conflict with the declared boundary and event-selection principles.
3. Year precision sorts all three before the January 9 crew announcement. The public page consequently opens with post-mission/ongoing material before the mission begins, making the chronology reader-visible and incorrect.
4. The title and summary promise a mission chronology “from its crew announcement to its splashdown and recovery,” so the extra entries contradict the product's own scope statement.

The core mission sequence is otherwise coherent, specific, non-duplicative, and well supported: crew announcement, launch, lunar-orbit insertion, landing, first step, EVA, ascent/rendezvous, transearth injection, and splashdown. Nevertheless, the explicit certification rule says technical publication is insufficient and that editorially poor output fails. The live result is therefore not certified.

## Publication, projections, search, and public rendering

- Production API `/api/timelines/the-apollo-11-mission`: HTTP 200, public ID `4000000003`, 13 events.
- Public page `/timeline/the-apollo-11-mission`: HTTP 200 and 108,847-byte server-rendered response.
- Browser accessibility-tree inspection confirmed the title, description, tags, all 13 event cards, event-detail controls, and source count render. It also independently confirmed the incorrect visible ordering described above.
- Search `/api/search?q=Apollo%2011`: returned the new timeline as the first result and its milestones.
- API event payloads and public event order match the Published Memory-derived read model exactly.
- Projection hash `4d499f51c6ce8eaf8c70838032a05c5c3670846f68349da594131dce959ece09` recomputed exactly.
- Public event source references derive from the consumed source snapshot.
- Existing Web and Berlin Wall Published Memory IDs, projection hashes, and update timestamps remained byte-for-byte unchanged from the pre-run baseline.

Collection-count deltas reconcile to exactly one request and its single publication chain: +1 request/ledger/job/run/quality/authority/Governance decision/approval/audit/admission/Published Memory/lifecycle/audit event, +2 source snapshots/corpus documents, +5 Factory artifacts, +14 Factory objects, +14 public/search/sitemap read models, +37 source records, +38 evidence records/validations/claim links, and expected category/tag projections. `failureRecords` remained unchanged. No unrelated topic or publication record was observed.

## Post-run security and operations

- Deployed revisions and 100% traffic remained unchanged for all five services listed in the pre-run state.
- Unauthenticated POST requests to priority, autonomous, and institutional workers each returned HTTP 403.
- IAM policies contain neither `allUsers` nor `allAuthenticatedUsers` bindings for those workers.
- Priority, autonomous, and institutional queues remained `RUNNING`; the completed priority task left no queued task or retry storm.
- Discovery remained `ENABLED` on `0 3 * * *` UTC without modification.
- All three ledgers are `PUBLISHED`; exceptional-review backlog and autonomous backlog are zero.
- Priority/institutional Cloud Run logs at severity ERROR or higher from immediately before intake through the post-run audit contained zero entries.

## Post-run repository certification gates

All code-level gates passed without test weakening or source changes:

- Functions tests: 35 passed, including Source Authority and Timeline Quality.
- Application tests: 249 passed.
- Editorial Intelligence: 68 passed.
- Historical Library: 7 passed.
- Published Memory: 7 passed.
- Projection Engine: 7 passed.
- Search: 8 passed.
- Platform: 8 passed.
- Root and Functions TypeScript checks: passed.
- ESLint: passed.
- Functions build and Next.js production build: passed.
- Root and Functions `npm audit --audit-level=high`: passed threshold with zero high/critical findings. Existing transitive findings remain 9 (1 low, 8 moderate) at root and 8 moderate in Functions.

These passing gates do not override the live editorial failure. They show that current automated coverage does not reject a closed-episode timeline whose year-only, ongoing/post-episode entries sort before its precise start boundary.

## Weaknesses discovered

The production run exposed a Timeline Quality/selection coverage gap: boundary and chronology checks accept entries based on `sortYear` alone when the start and end are inside the same year, even if the entry semantics describe an ongoing or post-boundary state. This allows non-event impact/legacy material into a closed-episode timeline and permits coarse year precision to place it before day-precision mission events.

This is not evidence that Source Authority V2 weakened or failed. Source Authority performed its intended claim/evidence role and preserved exact, independently corroborated lineage. The defect belongs to Timeline Quality scope/boundary/event-kind enforcement and its missing heterogeneous regression coverage. No code or production data was changed in this certification goal because remediation requires a separately reviewed policy correction; regenerating or editing this candidate would violate the controls.

## Final verdict

**SOURCE AUTHORITY V2 LIVE PUBLICATION: NOT CERTIFIED**

The real deployed path, immutable Source Authority V2 chain, Governance consumption, Historical Library transition, Published Memory, projections, search, API, rendering, security, and operations all functioned correctly. Certification nevertheless fails because the published Apollo 11 result is not editorially publication-worthy under the mandated reader review.

**BRANCH MERGE-READY: NO — correct and regression-test the closed-episode coarse-date/legacy-event escape, then perform a new explicitly authorized live certification.**
