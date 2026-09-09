# TL-EDITORIAL-EXCELLENCE-001 — Editorial Excellence Completion Program

Date: 2026-09-09

Overall verdict: **NOT_CERTIFIED — AUTHORIZED LIVE CERTIFICATION FAILED CLOSED**

Repository implementation verdict: **PASSING CANDIDATE**

## 1. Executive verdict

Editorial Excellence is not certified. Two separately authorized three-topic production samples completed with six terminal failures and zero publications. Fail-closed controls operated correctly, but the final `001D` sample demonstrated both priority/autonomous deployment skew and substantive historical-generation weaknesses. The final evidence is recorded in `TL-EDITORIAL-EXCELLENCE-001D.md`.

The first sample exposed reader-provider incompatibilities. `001A` and `001B` preserved those failures; `001C` established the final compatible semantic interface: a shallow provider-facing JSON envelope using ordinary-language identities, followed by an exact parser, bounded allowlist adapter, canonical Zod validation, deterministic semantic verification, and immutable reader lineage. The subsequent `001D` run still produced no publishable candidate, so implementation readiness must remain distinct from certification status.

## 2. Exact general failure modes discovered

1. Scope, candidate construction, significance, selection, redundancy, and omission were produced by one response without an independently locked editorial contract.
2. Temporal topic type existed, but subject class, title promise, inclusion/exclusion rules, opening test, terminal test, and selected-set sufficiency rationale were absent.
3. Event-count schema bounds could become a provider target instead of an editorial consequence.
4. Numeric significance factors did not explicitly distinguish essential, major, supporting, and excluded candidates or opening/turning-point/terminal narrative roles.
5. A repair could replace the complete scope while ostensibly correcting a downstream quality defect.
6. Provider-declared redundancy and omissions were not challenged by an independent whole-product reader assessment.
7. No gate assessed the final timeline's narrative progression or title/summary promise as a reader-facing historical product.
8. Governance and institutional transition had no immutable reader-level assessment lineage to verify.
9. The first implementation draft incorrectly caused the certified deterministic V3 revision preview to make a model call; compatibility review caught and removed that behavior before certification.
10. Vertex rejected the independent reader response grammar with `INVALID_ARGUMENT: The specified schema produces a constraint that has too many states for serving`; simplifying the explicit schema did not resolve the provider's constrained JSON-mode failure.

## 3. General corrections implemented

- Added an explicit editorial scope contract for all new provider plans: subject class, title promise, inclusion/exclusion rules, opening criterion, terminal criterion, and exact selected-set rationale.
- Added candidate editorial class and narrative role with a required selection rationale.
- Added deterministic validation for exactly one selected opening and terminal milestone, at least one turning point, selected `EXCLUDE`/`CONTEXTUAL` contradictions, and omitted `ESSENTIAL` candidates.
- Bound bounded plan/quality repairs to the first accepted scope using canonical semantic equality; broadened, narrowed, or reclassified repairs fail validation.
- Added a bounded independent reader evaluation covering nine complete-product criteria. The final `001C` transport uses a shallow provider-facing JSON schema with ordinary-language semantic fields; canonical vocabulary, normalization, Zod validation, and semantic enforcement remain server-owned and fail closed.
- Added deterministic reader-verdict validation; failed criteria, material findings, unknown event references, non-publication-worthy verdicts, and selection/composition mismatch fail closed.
- Added content-addressed immutable reader artifacts with model provenance and exact payload hashes.
- Required a passing reader assessment in routine Governance.
- Required institutional transition to independently verify artifact ownership, candidate reference, policy, nine passing criteria, publication-worthy verdict, zero unresolved reasons, and payload integrity.
- Preserved legacy deterministic V3 revision previews as zero-model-call operations; they cannot satisfy the new routine policy without a separately authorized current reader assessment.
- Versioned the active serverless pipeline, prompt, and Governance policy for the behavior change.

## 4. Files modified

- `functions/src/config.ts`
- `functions/src/schemas.ts`
- `functions/src/quality.ts`
- `functions/src/vertex.ts`
- `functions/src/pipeline.ts`
- `functions/src/serverless-contracts.test.ts`
- `functions/src/quality.test.ts`
- `functions/src/editorial-reader.ts` (new)
- `functions/src/editorial-reader.test.ts` (new)
- `functions/package.json`
- `docs/programs/TL-EDITORIAL-EXCELLENCE-001-PASS-A.md` (new)
- this record

## 5. Tests added or changed

Added coverage for:

- clean nine-criterion reader acceptance;
- material omission and non-publication-worthy rejection;
- unknown reader event references;
- candidate-to-composition mismatch;
- famous but peripheral padding;
- differently titled substantive redundancy;
- temporal imbalance;
- title/summary mismatch;
- explicit opening, turning-point, terminal, and essential-event contract enforcement;
- semantic scope equality and repair scope drift;
- all required temporal and subject structures;
- Governance failure when reader assessment is absent;
- static institutional reader-artifact propagation and verification.

Existing over-selection, under-selection, early concentration, stale endpoint, event semantics, legacy/context/future exclusion, omission semantics, partial-year precision, mixed precision, same-day ordering, Source Authority, and immutable lineage tests remain intact.

## 6. Heterogeneous regression result

**PASS — repository/non-public structural and editorial contracts.**

The corpus covers closed episode, crisis/conflict, biography, institution, technology, scientific development, cultural/intellectual movement, long-duration subject, and ongoing subject. It is deliberately non-public and does not constitute reader-level production certification.

## 7. Repository certification results

| Gate | Result |
|---|---:|
| Functions/Factory, Timeline Quality, Source Authority, serverless contracts | 132/132 PASS |
| Root application/operations/security/Governance compatibility | 249/249 PASS |
| Editorial Intelligence certification | 68/68 PASS |
| Historical Library certification | 7/7 PASS |
| Published Memory certification | 7/7 PASS |
| Projection Engine certification | 7/7 PASS |
| Search certification | 8/8 PASS |
| Public Platform certification | 8/8 PASS |
| Root strict typecheck | PASS |
| Functions strict typecheck | PASS |
| Root lint | PASS |
| Functions build | PASS |
| Next.js production build (52 static pages plus dynamic routes) | PASS |
| Root dependency audit at high threshold | PASS; 1 low and 8 moderate transitive findings remain |
| Functions dependency audit at high threshold | PASS; 8 moderate transitive findings remain |
| `git diff --check` | PASS |

No unsafe forced dependency downgrade was applied.

## 8. Live production certification

Founder authorization was consumed exactly once for this three-topic set. Preflight `/topic-status` reads returned 404 for every topic. Production intake returned HTTP 202 and `QUEUED` for all three:

| Class | Topic | Topic ID | Final state | Final stage | Attempts | Classification |
|---|---|---|---|---|---:|---|
| tightly bounded episode/crisis | The Suez Crisis | `e97b876e47b163a38f7bbdcc610afeb85895f5d3` | `FAILED` | `terminal` | 5 | implementation defect: Vertex reader transport incompatibility |
| medium scientific development | The Development of CRISPR Gene Editing | `1b712c23dce466d2428f0fbb45a2fdb1ad0ea7bb` | `FAILED` | `terminal` | 5 | implementation defect: Vertex reader transport incompatibility; one earlier scope-drift repair was also correctly rejected |
| long-duration/ongoing | The History of Vaccination | `7c444030d9e4af4116d5b1886305aaf7d085e528` | `FAILED` | `terminal` | 5 | correct fail-closed rejection: a non-event candidate was selected after bounded repair |

The first immutable attempt artifacts recorded 15, 11, and 15 selected milestones respectively. Deterministic Timeline Quality passed for those artifacts, but Source Authority was `failed` for all three. No publication package or Governance decision exists for any certification topic.

No additional topic was submitted. No direct database publication, manual repair, manual Governance decision, threshold change, topic hardcoding, or discovery resume occurred.

## 9. Reader-level live assessments

None. Every certification candidate failed before routine Governance, Historical Library admission, Published Memory, and public projection. Therefore there was no reader-facing product to approve and no hidden near-pass was represented as a success. The preserved Cuban Missile Crisis and Apollo 13 failures were not edited, replayed, regenerated, promoted, or reassessed.

## 10. Remaining editorial risks

- The final plain-text reader transport has repository coverage but no remaining authorized live topic on which to prove provider compatibility.
- The reader stage uses the configured production model in a separate bounded call; a future explicitly authorized run is still required to measure correlated planner/reviewer blind spots.
- A reader failure routes fail-closed rather than initiating another autonomous full-plan repair. This is deliberate because the candidate is already immutable and the writer/reviewer must not author missing history.
- The active V3 research pass still has less explicit pre-selection Source Authority machinery than shadow Factory V2; Source Authority remains an independent blocking gate, and live evidence is required to measure failure rates.
- Moderate transitive dependency advisories remain below the mandated high/critical threshold.
- Provider/schema compatibility was not represented in the repository mock contract before this live run; a provider-level canary should precede any future bounded certification authorization.

## 11. Production and discovery state

Fresh designated-identity production reads confirm autonomous discovery remains **PAUSED** on `0 3 * * *` UTC. The three production certification ledgers are terminal `FAILED`; none reached Governance or any public projection. Existing negative evidence was not mutated.

Fresh reconciliation on 2026-09-09 confirms `priority-topic-generation-00012-pav`, `autonomous-topic-generation-00018-sum`, and `institutional-transitions-00016-nit` are `ACTIVE` with 100% traffic. The autonomous and institutional source archives are identical and contain the final `001C` semantic reader adapter. Priority generation is an older, different source artifact and lacks that adapter. This skew is a known `NOT_CERTIFIED` production condition; it was documented, not repaired, during `TL-EDITORIAL-CHECKPOINT-001`.

Fresh public production reads on 2026-09-08 confirm `/api/timelines/the-cuban-missile-crisis` returns 404, `/api/timelines/the-apollo-13-mission` returns 404, and `/api/timelines/the-apollo-11-mission` remains 200. The preserved failed candidates have not leaked into public projections.

## 12. Git status

Branch: `codex/tl-content-reset-001`.

`TL-EDITORIAL-CHECKPOINT-001` reconciles and checkpoints the legitimate final Editorial Excellence implementation and evidence without deploying or altering production state. See `TL-EDITORIAL-CHECKPOINT-001.md` for the checkpoint commit and final status.

## 13. Merge readiness

**Repository checkpoint-ready, but not certified or ready for autonomous release.** Repository verification may establish an accurate implementation baseline; it cannot override the zero-publication production evidence.

## 14. Recommended next action

Keep Editorial Excellence `NOT_CERTIFIED` and autonomous discovery `PAUSED`. The read-only architecture decision selected Strategy C: integrate Factory V2 evidence-first knowledge completion and comparative selection into the existing production generation path while preserving certified institutional boundaries. That implementation has not begun. No further live Editorial Excellence certification is authorized before the resulting Evidence-First Generation path completes its required shadow certification.

## 15. Final `001D` certification status

The final authorized sample consisted of The 1906 San Francisco Earthquake, Ada Lovelace: Life and Work, and The History of the Olympic Games. All three exhausted five attempts and terminated `FAILED`; zero reached Governance, Historical Library, Published Memory, projection, or public publication.

- Earthquake persisted a 16-milestone candidate but failed Timeline Quality for material omission/date precision and Source Authority with 16 unresolved issues.
- Ada Lovelace persisted a 6-milestone candidate but failed Timeline Quality for a material omission and Source Authority with 5 unresolved issues.
- Olympic Games failed planning through scope drift, non-event selection, and over-selection; no valid candidate survived.
- Public intake used stale priority generation while the `001C` reader transport existed on autonomous generation.

These artifacts remain authoritative negative evidence. They must not be repaired, reset, resubmitted, or represented as near-passes.
