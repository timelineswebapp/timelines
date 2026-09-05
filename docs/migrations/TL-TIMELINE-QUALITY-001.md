# TL-TIMELINE-QUALITY-001 — Timeline Quality V1

Date: 2026-09-05
Quality policy: `timeline-quality-v1`
Pipeline: `serverless-pipeline-v3-timeline-quality`
Governance policy: `routine-governance-v2-quality`

## Observed production problem

The first clean-corpus publication, **The History of the World Wide Web**, proved the autonomous publication chain but not title-level editorial completeness. The immutable Factory candidate `a96e502fff652ed7d1fbe144d4ad1285ee1db81c` contains 18 events from 1989 through 2004. Thirteen events occur by 1994. Its hash remains `4f93c648d5e110a30d55f65e37dea1e9755cb39389bb0f3d90a93f9444af06b2`.

The old pipeline passed it because it enforced chronology, grounded references, source diversity, schema bounds, and duplicate signatures, but had no explicit title scope, era coverage, temporal balance, omission, redundancy, or endpoint-completeness gate.

## Quality model and scope planning

Generation now runs in this order:

`grounded research → scope/era/dimension plan → significance-scored candidate inventory → redundancy/omission review → selected-event composition → deterministic normalization → quality assessment → Governance`

The persisted plan records topic type, summary, start/end boundaries, ongoing status, granularity, subject-derived eras, dimensions, selection principles, and coverage risks. Supported temporal structures are closed episodes, ongoing subjects, biographies, institutions, and long-duration subjects. `standard` is the repository-backed default granularity; no public UI or DTO changed.

Every candidate records era/dimension membership, seven significance factors, a significance rationale, complete grounded evidence/source lineage, selection state, and a rejection reason when excluded. Supported final event count remains the existing schema bound of 6–20; event count is an output of selection rather than a target.

## Quality gates

The deterministic assessment fails routine publication for:

- an unrepresented declared era;
- obvious concentration (more than 65% in one primary era for timelines with at least 10 events and 3 eras);
- selected events outside declared boundaries or material boundary gaps;
- an ongoing endpoint unreasonably distant from the present, using a span-sensitive 10–25 year tolerance;
- unresolved substantive redundancy or major omissions;
- ungrounded plan/timeline references;
- duplicate or unplanned composed events;
- selection outside the supported 6–20 event range.

Quality failures receive up to two bounded editorial plan repairs against the same grounded corpus. Remaining failures enter exceptional human review. They never receive routine institutional transition.

## Deterministic normalization

Software may normalize whitespace, deduplicate tags/references, chronologically sort already-normalized date keys, discard singleton redundancy-review records, derive candidate sources from cited grounded evidence, and rank public evidence/source references deterministically.

Evidence references are ranked by grounded source coverage with stable original-order tie breaking. Public events retain at most three evidence and source references. The complete evidence/source inventory remains in grounded research and the private quality artifact. Unsupported evidence, contradictory dates, scope defects, omissions, substantive duplication, and weak/fabricated references are never normalized into acceptance.

## Persisted quality artifact

Each completed generated candidate receives an immutable `qualityArtifacts` document plus a Factory artifact reference. It contains the scope assessment, boundaries, classification, era map, complete candidate inventory, selected IDs, rejected candidates/reasons, coverage and event distributions, redundancy review, omission review, final verdict, unresolved reasons, model provenance, payload hash, and policy version. Certification fixtures are explicitly `publicationEligible: false`.

Governance packages now carry `qualityArtifactRef`, `qualityPolicyVersion`, and `qualityVerdict`. Routine policy requires a passing quality verdict in addition to existing evidence, source, chronology, and duplicate checks. Failed verdicts create the existing publication-readiness human-review queue.

## World Wide Web before/after

| Measure | Published fixture | Non-public V1 candidate |
|---|---:|---:|
| Factory object | `a96e502f…` | `96330a34…` |
| Quality artifact | none | `fa9657256122533d8f3ed18a068b41176f7ac9b8` |
| Events | 18 | 16 |
| Coverage | 1989–2004 | 1960–2023 |
| Declared eras | none | 5, all represented |
| Quality verdict | old gates passed | passed |
| Governance preview | routine under old evidence-only policy | routine under V1 quality policy |
| Publication eligible | already published | false |

The replacement explicitly scopes one hypertext precursor, the Web’s birth, commercialization, Web 2.0/mobile platform period, and modern decentralization/AI/challenge period. Unlike the published fixture it represents the modern state and passed era coverage, temporal balance, redundancy, omission, endpoint, evidence, and selection-integrity checks. It was not published and did not alter canonical lineage.

Observed likely omissions in the published fixture include mobile Web adoption, the standards-rich application platform, security/privacy evolution, modern platform concentration, and the Web’s current AI/decentralization debates. Its early proposal/release/browser cluster is too granular for a broad standard timeline.

## Additional fixtures

| Class | Topic | Result | Events / coverage | Quality artifact | Public |
|---|---|---|---|---|---|
| Closed episode | French Revolution | passed | 20 / 1788–1799 | `9db6cb5ea54961316c9c5f3c03879d7a78e2755a` | no |
| Biography | The Life of Marie Curie | passed under final boundary gate | 13 / 1867–1934 | `3e772346525303616a04d2fc75b57af777143fa5` | no |
| Ongoing institution | The History of the Hubble Space Telescope | passed under final boundary/future gate | 11 / 1923–2026 | `846fd10c2c83b1fea95df8a93c76ba8c69d20377` | no |

All accepted artifacts were re-evaluated against the final code and their original grounded source snapshots; all four returned `passed` with no unresolved reason. The failed Space Exploration run is retained as negative evidence: Vertex referenced omission milestones absent from its candidate inventory, and the lineage validator refused composition. A separate Hubble attempt containing a future 2033 milestone motivated the final future-event gate; the final Hubble fixture ends in 2026.

## Verification record

- Functions quality/Governance/contracts: 14/14 passed.
- Application suite: 245/245 passed.
- Editorial certification: 68/68 passed.
- Historical Library: 7/7 passed.
- Published Memory: 7/7 passed.
- Projection Engine: 7/7 passed.
- Search: 8/8 passed.
- Public Platform: 8/8 passed after its stale pre-serverless matcher was updated to recognize corpus-scoped Firestore reads and the current `no-store`/`force-dynamic` cache contract.
- Root and Functions typecheck: passed.
- Lint: passed.
- Functions build and Next.js production build: passed.
- Dependency audit: zero high or critical findings; root has 1 low/8 moderate transitive findings and Functions has 8 moderate transitive findings.
- Production public API: `serverless-public-api-v2-clean-corpus`, one active Web timeline, expected public/site DTO title.
- Clean-corpus health: `timelines-clean-2026-09-v1`, `NO_LEGACY_CONTENT_REUSE`.
- Legacy route sample `2009-flu-pandemic`: Cloud API 404 and production site 404.
- Published Web fixture hash/event count/end year remain unchanged.

## Deployment and autonomous discovery state

Final generation-worker revisions: `priority-topic-generation-00007-wof` and `autonomous-topic-generation-00007-gul`, active with 100% traffic.

`topic-discovery-daily` was paused throughout implementation and certification, then resumed only after every required gate passed. It is **ENABLED** on the unchanged `0 3 * * *` UTC schedule. Priority, autonomous-worker, and institutional queues remain **RUNNING**. The conservative discovery caps remain 10 candidates and 3 promotions. Missing-a-topic requests continue to enter `intakeTopic` with user origin, priority 1000, and `enqueueGenerationTask(..., true)`; retry routing preserves non-autonomous priority. Founder/Admin paths and existing public reads were not disabled. No corpus was mass-regenerated and no test fixture was published.

## Remaining quality risks

- Vertex sometimes emits malformed cross-references or candidates without grounded evidence. Bounded repair and fail-closed validation contain the risk; provider repair/failure rates should be monitored.
- Broad topics can produce defensible but expansive precursor scopes. Boundary representation is enforced, but editorial sampling should continue during early autonomous growth.
- Moderate transitive dependency advisories remain; none are high/critical, and forced audit fixes would require unsafe breaking downgrades.

## Certification state

**TIMELINE QUALITY V1: CERTIFIED**

Certification was granted only after the Web regression, three heterogeneous fixtures, live Vertex grounding, persisted artifact re-evaluation, Governance routing, all test/build/security/compatibility gates, clean-corpus isolation, final deployment, and controlled discovery resumption passed.
