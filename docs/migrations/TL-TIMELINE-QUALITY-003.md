# TL-TIMELINE-QUALITY-003 — Event Semantics, Closed-Episode Boundaries, and Date Precision

Date: 2026-09-05

Corpus: `timelines-clean-2026-09-v1`

Policy: `timeline-quality-v3-event-semantics`
Final verdict: **TIMELINE QUALITY V3: NOT CERTIFIED**

## Defect and policy correction

Apollo 11 generation 1 contained 13 public events. Three coarse `1969` entries described continuing legacy or preservation states rather than occurrences, so they sorted ahead of the actual mission sequence. V3 classifies every candidate before significance and selection as `EVENT`, `STATE_LEGACY`, `CONTEXT`, or `FUTURE`; only `EVENT` is chronology-eligible. Excluded material and reasons remain in the private quality artifact.

Closed episodes now compare the complete interval implied by each event's declared precision with the actual declared boundaries. A year-only item cannot be presumed to occur on January 1 or safely inside a partial-year episode. Day, month, year, and approximate precision are explicit and validated against nullable sort components. Mixed-precision intervals that overlap preserve stable input order rather than manufacturing precision. Same-day events retain their persisted order; V3 adds no fabricated clock times. The Berlin Wall same-day case remains regression-covered.

Timeline Quality V2 omission classes remain intact. Only an unresolved missing material milestone blocks routine publication; contextual themes, outside-scope material, granularity-inappropriate material, and already represented material remain non-blocking. Evidence, chronology, era coverage, boundary, future-event, redundancy, provenance, and Source Authority V2 gates were not weakened.

## Apollo 11 reassessment and revision

The non-public deterministic reassessment reused immutable candidate `d91256c6772d84c6655f157386144f52a10f4d84` and exact source snapshot `273f499c55ad937c691b6a2cbe500e7723a12fda`; it made no Vertex call and was not publication-eligible. Quality artifact `d5d15dcd592e4da7320b8781f6cbfa22640a9fe0` and Source Authority artifact `3e72ed3e583f6a806cbfc1ff44cf0c7a1b28aa2b` passed routine Governance preview.

V3 excluded:

- `Ongoing Study of Lunar Samples` — `STATE_LEGACY`
- `Legacy of Scientific Instruments on Moon` — `STATE_LEGACY`
- `Command Module 'Columbia' on Display` — `STATE_LEGACY`

The existing institutional path published generation 2 with 10 events. Generation 1 remains immutable and recoverable.

| Record | Identity / result |
|---|---|
| Prior Published Memory | `84007fa50a977eec8708ab8945f23fb6991b0e7b--g1`, 13 events, authority hash `a8357c0465dec4f8009d841b4b87961048290c9e299880acab6439dc7d93959b` |
| Revised Published Memory | `84007fa50a977eec8708ab8945f23fb6991b0e7b--g2`, 10 events, authority hash `8cf6ae79077a29f339c4cc752f2822398d63282b88b2de94f7eaa9fd70358752` |
| Public identity | Timeline ID `4000000003`; canonical slug `the-apollo-11-mission`; no duplicate timeline |
| Active projection | Points to generation 2 and begins `Apollo 11 Crew Announced` on January 9, 1969 |
| Reader rendering | 10 events, January 9 through July 24, 1969; no legacy/state cards |

Search, sitemap, public API, and the rendered canonical page use generation 2. Removed generation-1 milestones are superseded in projections rather than deleted.

The first institutional delivery was safely discarded because the existing institutional task schema accepted UUID job IDs while this deterministic policy-revision run used a SHA-1 identifier. No public state changed. The institutional boundary was extended only for content-addressed revision IDs, redeployed, and the unchanged queued Governance package was redelivered under a distinct recovery delivery identity. No content was regenerated and Firestore was not manually edited.

## Regression coverage

The Functions suite covers:

- all four semantic classes and EVENT-only selection;
- the exact Apollo 13-to-10 legacy exclusion;
- partial-year closed-episode rejection of ambiguous year-only events;
- legitimate coarse precision in heterogeneous ongoing, biography, and long-duration fixtures;
- mixed year/month/day ordering without a silent January 1 assumption;
- stable Berlin Wall same-day ordering without invented times;
- V2 omission semantics and fail-closed material omissions;
- Source Authority V2 publication ownership and claim validation.

## Genuine live certification

Exactly one new production request was submitted through `POST /api/timeline-requests` after confirming it was absent from the ledger and projections.

| Field | Result |
|---|---|
| Topic | The Cuban Missile Crisis |
| Topic ID | `7d83e1b9dd32107a1b95c67a79e8edfb710583b0` |
| Job ID | `a5c29a9e-aac2-4f37-9d08-072e52d1ae40` |
| Intake | 2026-09-05T18:38:33.926Z |
| Worker start | 2026-09-05T18:38:34.802Z |
| Review transition | 2026-09-05T18:45:03.650Z |
| Duration | 389.724 seconds intake-to-review; attempt 1 of 5 |
| Final state | `AWAITING_REVIEW` / `governance_review`; no active or stale ledger lease; no task retry or last error |
| Quality artifact | `07b59bec620707dff95acf8f2d54271be15592c4` — failed |
| Source Authority artifact | `1e394a4dd0a0e30ce9b2d445720d734732c674c7` — failed |
| Governance package | `672d0f55-5f11-57d6-b509-a94bc874b0df` — exceptional |

The worker naturally stopped before Historical Library and publication. It received two bounded plan-schema repairs and two bounded editorial-quality repairs within the same attempt. The final plan selected 27 events against the supported 6–20 range, the composed 20-event candidate could not match seven selected items, and five material milestones remained unresolved. Source Authority also lacked sufficient strong claim-relevant support for multiple selected claims after its bounded repair. These are substantive provider/output and evidence-authority failures, not a date-boundary-policy defect; the fail-closed quality and Governance behavior is correct. The request was not advanced, replayed, regenerated, or edited.

Therefore:

- **TIMELINE QUALITY V3: NOT CERTIFIED** — the required new live request did not pass reader-level publication certification.
- **SOURCE AUTHORITY V2 LIVE PUBLICATION: NOT CERTIFIED** — the same live request failed Source Authority and never published.

## Verification

| Gate | Result |
|---|---|
| Functions quality/contract/Source Authority | 42/42 passed |
| Application suite | 249/249 passed |
| Editorial certification | 68/68 passed |
| Historical Library | 7/7 passed |
| Published Memory | 7/7 passed |
| Projection Engine | 7/7 passed |
| Search | 8/8 passed |
| Platform | 8/8 passed |
| Root and Functions typecheck | passed |
| ESLint | passed |
| Functions build | passed |
| Next production build | passed |
| Dependency audit | no high or critical findings; existing moderate transitive findings remain |

## Deployment and operations

- Priority worker: `priority-topic-generation-00011-jon`, active, 100% traffic.
- Autonomous worker: `autonomous-topic-generation-00011-haf`, active, 100% traffic.
- Institutional worker: `institutional-transitions-00009-joc`, active, 100% traffic.
- All three Cloud Tasks queues are `RUNNING`, bounded to five attempts.
- Worker runtime identity remains `timelines-runtime@tiimeliines.iam.gserviceaccount.com`; institutional invocation is not public.
- Discovery scheduler `topic-discovery-daily` remains **PAUSED** on its unchanged `0 3 * * *` UTC schedule because the live certification failed.
- User and Admin priority intake remains available. The existing autonomous exceptional-review suppression remains enabled.

## Remaining risks

The live run exposed that the editorial-plan schema bounded total inventory but did not reject more than 20 selected candidates until deterministic quality assessment. The schema now rejects over-selection before candidate composition so bounded model repair receives the defect directly; regression coverage reproduces the exact 27-selected failure. Source coverage for broad closed episodes can still remain insufficient after the bounded authority repair. Both conditions fail closed and remain operationally visible in Governance review. No additional production request is authorized under this certification run, so a future explicitly authorized certification is required before discovery can resume or V3 can be declared certified.
