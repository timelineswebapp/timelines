# TL-EVIDENCE-FIRST-GENERATION-001 — Acquisition Runtime Remediation

Date: 2026-09-09

## 1. Verdict

`NOT_READY_FOR_SHADOW`

The one authorized Printing Press canary failed closed before a Completed Knowledge Set. The model-produced query plan violated the locked contract: `At most three phase/dimension queries are allowed.` Olympic Games was therefore not executed. No retry or frozen SHADOW run occurred.

## 2. Printing Press latency breakdown (preserved deadline run)

The preceding preserved Printing Press initial acquisition lasted 439,974 ms. Recorded provider stages were Scope 9,253 ms, Research Map 25,057 ms, Query Plan 3,870 ms, Grounding 68,988 ms, and Claim Extraction 66,396 ms: 173,564 ms total. The remaining 266,410 ms covered retrieval, persistence, authority evaluation, resolution, coverage, and audit work, but the preserved instrumentation cannot divide that interval without inference.

Its completion run lasted 483,375 ms and persisted three grounding calls totaling 45,227 ms, 19 provider-reported queries, 57 unique discoveries, six newly retrieved snapshots, and one unavailable snapshot. No post-retrieval extraction audit was created. Retrieval/persistence and the missing stage boundaries account for the unallocated interval; exact start/end timestamps for each internal retrieval were not historically recorded.

The newly authorized canary has no trustworthy stage or wall-clock telemetry in its report because strict query-plan parsing escaped as `UNHANDLED` before the acquisition error wrapper. No duration is inferred.

## 3. Primary latency bottlenecks

The dominant demonstrated bottleneck was completion retrieval: 30 candidates at concurrency three, with up to 10 seconds for robots plus 30 seconds for fetch, creates an approximately 400-second worst-case retrieval envelope before extraction and persistence. Provider work was material but not dominant. The initial run also had 266,410 ms of unsegmented non-provider work, which remains an explicit instrumentation gap.

## 4. Duplication and serialization findings

The completion round issued distinct gap-directed tasks and discovered 57 unique URLs from 57 chunks; no duplicate discovery URLs were found. Source-cache reuse already suppresses repeated retrieval where a reusable snapshot exists. Per-host serialization is intentional for responsible access, while global concurrency remains bounded at three. The three completion tasks overlapped thematically but mapped to distinct locked coverage gaps; there is no evidence of repeated claim extraction or event resolution in the failed completion run.

## 5. Retrieval fallback findings

Thirty of 57 discoveries were selected, 22 were excluded by budget, and five were prohibited. Recorded failures included two Texas A&M robots denials, Academia and Pressbooks robots denials, one HTTPS-required rejection, and one abort. Security policy was correct and unchanged. The defect was excessive completion breadth: all 30 candidates were admitted even though only three unresolved questions required bounded authoritative alternatives.

## 6. Completion-round necessity

Completion was historically necessary, not an accounting defect. `Industrialization of Printing` was missing; `Impact and Consequences` and `Economic Impact` were weak; supported chronology ended at 1234; and critical software questions for industrialization, consequences, and economic impact remained missing or weak. Existing supported claims and events were credited. No phase, dimension, or event-to-question accounting defect was demonstrated, and no coverage threshold was lowered.

## 7. Deadline policy

The completion deadline remains 480 seconds and the initial V2-A cap remains 600 seconds inside the 1,200-second worker envelope. Available prior initial acquisition durations were 323.9 seconds, 375.9 seconds, and 440.0 seconds, giving an observed median of 375.9 seconds and observed maximum/empirical p95 of approximately 440.0 seconds for this small sample. Ada's 690.5-second total included completion and is not an initial-only datum. With three completion questions and four ranked alternatives each, retrieval falls from 30 to at most 12 candidates; the timeout-envelope estimate falls from about 400 to about 160 seconds. Together with the observed 45-second grounding work, this should fit the unchanged 480-second fail-closed bound. No deadline or provider budget increased. Expected cost and throughput improve because completion can retrieve at most 12 rather than 30 candidates in this observed shape.

## 8. Telemetry improvements

`V2ARunError` now carries accumulated metrics, including provider calls, retries, stage latency, token counts, provider queries, source ranking, started retrieval attempts, successes, failures, per-URL hashed rejection reason/latency, claims, verdicts, conflicts, entities, and events. `KnowledgeConstructionError` preserves initial plus partial completion metrics, and the canary runner serializes them. Started and successful retrieval counters now update inside each bounded task rather than only after the full batch resolves.

The authorized canary exposed a separate remaining gap: query-plan schema errors are still reported as `UNHANDLED` with `telemetry: null`. This run is preserved as evidence and was not repaired or retried.

## 9. Exact implementation changes

- `functions/src/factory-v2/reliability.ts`: cap gap-completion source selection at four ranked alternatives per question.
- `functions/src/factory-v2/orchestrator.ts`: accumulate partial execution and retrieval telemetry and throw it through `V2ARunError`.
- `functions/src/evidence-first/knowledge.ts`: retain partial V2-A metrics across completion failures.
- `scripts/run-evidence-first-acquisition-canary.ts`: emit accumulated failure telemetry and the exact conditional Printing Press/Olympics sequence.
- `functions/src/factory-v2/reliability.test.ts` and `functions/src/evidence-first/knowledge.test.ts`: cover the retrieval bound and partial-metric propagation.

No authority threshold, security control, comparative selection, Event Lock, composition, final Source Authority, or reader behavior changed.

## 10. Tests added or changed

Added a deterministic test proving ten candidates for one gap yield four retrieval candidates and six budget exclusions. Added coverage proving acquisition metrics survive deadline/error wrapping. The existing authority, alternative-source, corroboration, weak-evidence, security, retrieval, and institutional-boundary tests remained green.

## 11. Repository verification

- Functions suite: 180 discovered, 178 passed, 0 failed, 2 skipped.
- Functions strict typecheck: passed.
- Functions build: passed.
- Root strict typecheck: passed.
- ESLint: passed.
- Next.js production build: passed.
- `git diff --check`: passed.
- `bash -n infra/gcp/deploy-serverless.sh`: passed.

## 12. Printing Press targeted canary

Release `8fdbd232871895149e0f5141876023806b4ff362b14053f50615c7fd16088a64` failed closed at `UNHANDLED` during query-plan validation with `At most three phase/dimension queries are allowed.` No Completed Knowledge Set was produced.

## 13. Olympic Games

`NOT_EXECUTED_AFTER_CANARY_FAILURE`, exactly as the conditional authorization required.

## 14. Runtime, provider, token, and cost metrics

For the preserved deadline run: initial acquisition used 17 provider calls, 25 unique reported queries, 101,132 input tokens, 22,526 output tokens, and 173,564 ms recorded provider latency. Completion persisted three calls, 19 queries, 463 input tokens, 2,559 output tokens, and 45,227 ms grounding latency. Monetary cost was not available. The newly authorized failed run recorded `telemetry: null`; provider/token/cost totals cannot be truthfully reconstructed from its terminal report.

## 15. Protected state

Before and after were identical (`unchanged: true`): governancePackages 8 / `b388220889349d275404da89e18bbf516d3a7ded1b8cac706e9c3fed2f45ad9f`; governanceDecisions 4 / `4828484523c04a93e75cd5f987e26b7b59cb456dd0e3c897205bbf88af992c72`; governanceQueues 4 / `cb0bc40232628f9c4867966be17b40f9f21a939b51242680a0583472c92539e0`; libraryAdmissions 4 / `86f91d6fd746bf3444e08f22f4d81d72db04477091f78724399090b6f3a28ddc`; publishedMemory 4 / `552231791faefdc7cd8aff838671222e3195780f74974d4e699e31f2ed23bd65`; platformReadModels 46 / `15d1d4a1201b4bb422284aef3965bbd074e14c19d4ea12026fd4e43f90893aaf`; searchDocuments 46 / `d4919d3fa47be1df2ef92ac6fcddf237f88bda8ca772174005d73a8dac2bb173`; sitemapDocuments 46 / `7d62a69145c8561279938c45b49a58b8f7695549dfde178a99e8180fe0030aef`.

## 16. Configuration and discovery

Configuration remained `SHADOW`, tuple `.13 / .5 / .11 / .8`, `killSwitch=false`, `publicationEnabled=false`, `governanceSubmissionEnabled=false`, and `autonomousDiscoveryEnabled=false`. Discovery remained `PAUSED`.

## 17. Files modified

The narrow runtime remediation modified the five implementation/test files listed in sections 9–10 and produced this report plus the sealed canary artifact. The worktree also contains the broader, pre-existing uncommitted TL-EVIDENCE-FIRST-GENERATION-001 implementation and artifacts; they were preserved.

## 18. Git status

The worktree is dirty and uncommitted. No commit, push, merge, deployment, configuration mutation, or destructive cleanup occurred. The unrelated `docs/.DS_Store` remains untouched.

## 19. Five-subject acquisition proof

Not PASS. Earthquake, Berlin, and Ada remain preserved passes. Printing Press still lacks a valid Completed Knowledge Set. Olympics remains unexecuted.

## 20. Frozen SHADOW determination

Restarting the frozen 30-subject SHADOW certification is not justified and was not attempted. The state remains `NOT_READY_FOR_SHADOW`. A further targeted remediation/canary would require new authorization.

Canonical authorized-run report: `artifacts/evidence-first-acquisition-canary/8fdbd232871895149e0f5141876023806b4ff362b14053f50615c7fd16088a64/report.json`.
