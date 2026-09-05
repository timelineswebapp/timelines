# TL-TIMELINE-QUALITY-002 — Omission Semantics

Date: 2026-09-05
Quality policy: `timeline-quality-v2-omission-semantics`
Governance policy: `routine-governance-v3-omission-semantics`

## Production incident

The user request **The Fall of the Berlin Wall** entered clean corpus `timelines-clean-2026-09-v1` at `2026-09-05T10:21:28.121Z`. Generation completed on its first worker attempt in 3m42.878s with 31 grounded sources, 40 grounded evidence segments, 12 selected milestones, 20 evidence records, 20 claim links, and 20 passed evidence validations. Timeline Quality V1 sent the candidate to exceptional review because the model marked two potential omissions `unresolved`, despite explaining that one was a contextual non-event theme and the other was outside the declared scope.

V1 treated every unresolved omission as publication-blocking. That collapsed semantic suitability into resolution state and produced a false-positive quality failure.

## Corrected deterministic policy

Every potential omission is classified as one of:

- `missing_material_milestone`: blocking while unresolved;
- `contextual_non_event_theme`: non-blocking;
- `outside_declared_scope`: non-blocking;
- `inappropriate_for_granularity`: non-blocking;
- `already_adequately_represented`: non-blocking with a represented resolution and candidate.

New Vertex plans must provide the classification explicitly. Schema validation rejects inconsistent represented or missing-material combinations. Legacy artifacts receive a narrow deterministic compatibility classification. Ambiguous legacy omissions default to `missing_material_milestone` and remain blocking.

Evidence, chronology, era coverage, temporal balance, scope boundaries, future-event rejection, redundancy, candidate-selection integrity, and provenance gates are unchanged.

## Autonomous-review visibility

Topic discovery now performs a bounded pre-promotion check for autonomous ledgers in `AWAITING_REVIEW`. If any exist, it performs no discovery or promotions, emits a structured warning, and persists an `adminOperations` record containing the suppression reason and bounded backlog. New Governance packages and queues record their origin.

Discovery was paused during deployment and production correction. The initial pause attempt under an unauthorized account failed without changing state; the designated deployment account then paused it successfully. After certification, the backlog was zero and the scheduler was restored to `ENABLED` on the unchanged `0 3 * * *` UTC schedule.

## Existing-candidate reassessment

The Berlin candidate was not regenerated. The reassessment command validated active job ownership and reconstructed the plan, candidate, grounded source catalog, and evidence catalog from immutable persisted records.

Corrected assessment:

- contextual non-event: `Daily realities of life under the Wall`;
- outside declared scope: `Complexities of post-reunification integration`;
- all eight quality checks passed;
- no unresolved blocking reasons.

New quality artifact: `0a585fc58d4dd3ac158f59a2aa881ae8454ba25c`
New Governance package: `fbe8e48f-6cde-5da2-b38b-47751de27774`

The V1 failed quality artifact and exceptional package remain immutable. Their review queue entry was marked `SUPERSEDED` with an audit event linking the V1 and V2 quality artifacts.

## Production publication certification

- Published at: `2026-09-05T13:48:10.687Z`
- Timeline ID: `4000000002`
- Route: `/timeline/the-fall-of-the-berlin-wall`
- Published Memory: `378338ba105ec8027857ae7fb72c3dd41baefff2--g1`
- Authority hash: `28cd4dda6c970428890c9a11c8951492bfb6122e71a973f0eb10f92dc707106d`
- Projection hash: `5b4c0fac4421dab2eed160dba29058d41c3cfb611237a83677f2283e9f67b54b`
- Governance: one approved decision and one automated approval
- Historical Library: one admitted package
- Projections: one timeline and 12 milestone read models
- Search: 13 documents
- Sitemap: 13 documents
- Public API topic status, timeline lookup, and search passed
- Production page returned HTTP 200 with the correct title

## Deployed revisions

- `priority-topic-generation-00008-lov`
- `autonomous-topic-generation-00008-zay`
- `institutional-transitions-00006-fop`
- `topic-discovery-00005-qah`

All revisions are active with 100% traffic. The public API and website were not redeployed.

## Verification

- Functions quality, Governance, and serverless contracts: 18/18 passed.
- Application suite: passed.
- Editorial certification: 68/68 passed.
- Historical Library certification: 7/7 passed.
- Published Memory certification: 7/7 passed.
- Projection Engine certification: 7/7 passed.
- Search certification: 8/8 passed.
- Public Platform certification: 8/8 passed.
- Root and Functions typecheck: passed.
- Root lint: passed.
- Functions and Next.js production builds: passed.
- Persisted Berlin re-evaluation: passed without regeneration.

## Certification state

**TIMELINE QUALITY V2 OMISSION SEMANTICS: CERTIFIED**
