# TL-EVIDENCE-FIRST-GENERATION-001 — Printing Press Authority Remediation

Date: 2026-09-09

## 1. Verdict

`NOT_READY_FOR_SHADOW`

The targeted Printing Press canary did not produce a Completed Knowledge Set. Its initial acquisition materially succeeded—17 supported claims and 11 event candidates—but its one allowed gap-completion run exceeded the fixed V2-A ten-minute deadline. The runner stopped and did not execute Olympic Games.

## 2. Preserved 40-claim forensic summary

The complete claim-by-claim record is preserved in `artifacts/evidence-first-acquisition-canary/ef51cba3bc1c94a79a432b38d8e944eeced6fc891556a32d47680574d4620fc2/printing-press-authority-forensics.json` (SHA-256 `078edde0f58aeafe4ba02089506ac481445bff6639d06228a025068b969b994d`). It contains all requested fields for all 40 claims and their 47 evidence edges.

- Claim types: 30 `OCCURRENCE`, 8 `CONSEQUENCE`, 2 `DATE`.
- Risk: all 40 `ROUTINE`; historical importance was not present and is recorded as null.
- Evidence edge count: 34 claims had one edge, 5 had two, and 1 had three.
- All 47 edges were `SUPPORTS` + `DIRECT`; no direct/indirect linkage misclassification was found.
- All 47 edges referenced `PROVISIONAL` publishers and were `UNCLASSIFIED`.
- Every claim received exactly `WEAK_AUTHORITY` and `MISSING_EVIDENCE`; no edge was accepted.
- Evidence-edge domains: journalism.university 10, EBSCO 10, Fabrizio Musacchio 8, Printivity 7, Asian Art Museum education 6, and Conversable Economist/Blogspot 6.
- Stronger discovered institutional candidates existed for all 40 claims' research context, but no stronger retrieved evidence was found orphaned from a claim. Claim splitting, edge competition, lost corroboration, and directness were not the defect.

## 3. Preserved 75-source funnel

The exact 75-row source funnel is in the same forensic artifact.

| Disposition | Count |
|---|---:|
| Not selected by initial ranking | 55 |
| Recognized authoritative but not successfully retrieved | 5 |
| Potentially authoritative but unrecognized | 9 |
| Orientation/provisional | 5 |
| Inaccessible | 1 |

The preserved execution attempted only 12 retrievals despite a 60-document maximum, proving the global source budget was not saturated. Nine source documents/snapshots were preserved; the canary telemetry counted ten successful retrieval attempts before content deduplication. The authoritative candidates included university/library, museum, scholarly-publisher, scholarly-society, UNESCO, and Britannica signals. The ranking treated unrecognized institutional candidates like general sources, so early accessible general sources consumed the per-question slots. Britannica was selected but unavailable. The forensic script's post-hoc `admitted` field reconstructs the repaired ranking and is not represented as the historical admission decision; the historical runner did not persist initial ranking decisions.

## 4. Exact authority-starvation roots

1. Initial ranking recognized only exact bootstrap-registry publishers; controlled academic namespaces were classified later, after retrieval, and therefore could not win retrieval capacity.
2. Several legitimate named institutions in the observed pool were absent from the bounded registry.
3. Accessible provisional pages consequently displaced stronger institutional candidates at the per-question boundary.
4. Authority evaluation behaved correctly once given the resulting graph: `PROVISIONAL` + `UNCLASSIFIED` evidence cannot satisfy even a routine claim.
5. Claim/evidence linkage was intact; the starvation occurred before and during source selection/classification.

## 5. Authority-model changes

The bounded registry now explicitly identifies UNESCO, the Metropolitan Museum of Art, the Asian Art Museum, Oxford University Press, and IEEE. These are named institutions with defined authority domains and independence identities, not a permissive `.org` rule. The registry remains bounded at or below 32 entries.

Controlled university/government/intergovernmental namespace classification was tightened: a suffix alone no longer creates a verified publisher. The resolved hostname or path must also identify an institutional unit such as an archive, library, museum, press, research unit, records collection, or publication collection. Claim-level directness and existing risk/corroboration burdens remain mandatory.

## 6. Source-prioritization changes

Controlled academic candidates receive a retrieval-priority signal only when both the query role is non-orientation and the locked query plan requests `PRIMARY_INSTITUTIONAL` or `SCHOLARLY_SECONDARY` material. This signal affects retrieval ordering only; it does not make evidence authoritative. Wikipedia/orientation exclusions and deterministic domain diversity remain unchanged.

## 7. Claim/evidence-linkage changes

No linkage behavior was changed. The forensic graph proved all 47 edges were direct and attached to the exact extracted segments. There was no stronger retrieved evidence left unlinked and no lost cross-publisher corroboration to repair. Existing exact-proposition contributor merging remains authoritative.

## 8. Budget decision

No budget changed. Only 12 of the 60 permitted source-document slots were used in the failed preserved run. Increasing the ceiling would not address the per-question ranking defect and would add latency/cost without deterministic benefit.

## 9. Tests

Added or tightened coverage for institutional retrieval priority ahead of orientation material, suffix-only false authority, institutional-unit verification, and the bounded named publisher registry. Existing suites already cover authoritative alternatives after inaccessible sources, direct evidence linkage, independent corroboration, weak-only insufficiency, evidence-rich support, authority-starvation reason codes, security policy, and retrieval ceilings.

## 10. Repository verification

- Functions: 178 discovered; 176 passed; 0 failed; 2 emulator-only skipped.
- Functions strict typecheck and build: passed.
- Root strict typecheck: passed.
- ESLint: passed.
- Next.js production build: passed.
- `git diff --check`: passed.
- Deployment script shell syntax: passed.

## 11. Printing Press targeted canary

- Release: `b8325d96797746f4e969f08423648059d9e2f6a5cbfa5a7b0aa55b2855530c7a`.
- Initial run `66cb011a-50e0-41f5-ad69-1f59e08b8814`: `PASS`, 5 durable usable sources at terminal projection, 46 claims, 17 supported claims, 3 entities, 11 event candidates, 7 conflicts, 439,974 ms.
- Coverage required the single permitted completion round.
- Completion run `evidence-first-completion-d911ea88-29ab-4f40-a7a2-ee47d8777ae5`: failed closed with `WHOLE_RUN_DEADLINE_EXCEEDED` at `A2_SCOPE_ACQUISITION`, 483,375 ms.
- Final outcome: no CKS; `NOT_READY_FOR_SHADOW`.

This demonstrates that the original zero-authority defect was corrected, but the complete targeted canary still failed its CKS requirement.

## 12. Olympic Games result

`NOT_EXECUTED_AFTER_CANARY_FAILURE`. Its conditional authorization was not reached.

## 13. Executed canary metrics

Initial Printing Press acquisition used 17 provider calls, 25 unique provider-reported queries, 68 discovered source URLs, 101,132 input tokens, 22,526 output tokens, and 173,564 ms of recorded provider-stage latency. The completion run persisted 3 provider calls, 19 unique reported queries, 57 discovered URLs, 463 input tokens, 2,559 output tokens, 45,227 ms grounding latency, 6 newly retrieved snapshots, 1 unavailable snapshot, one HTTPS-required rejection, multiple robots denials, and one abort before its deadline failure. Monetary cost remained `NOT_MEASURABLE`.

The runner's terminal exception report has `telemetry: null` because completion deadline failures are not yet wrapped by `KnowledgeConstructionError`. The underlying immutable operations, discoveries, model executions, snapshots, failure record, console rejection diagnostics, and protected-state proof remain preserved. This is an instrumentation defect; it was discovered after the authorized run and was not repaired or rerun.

## 14. Protected-state proof

Before and after counts and SHA-256 hashes were identical:

| Collection | Count | SHA-256 |
|---|---:|---|
| governancePackages | 8 | `b388220889349d275404da89e18bbf516d3a7ded1b8cac706e9c3fed2f45ad9f` |
| governanceDecisions | 4 | `4828484523c04a93e75cd5f987e26b7b59cb456dd0e3c897205bbf88af992c72` |
| governanceQueues | 4 | `cb0bc40232628f9c4867966be17b40f9f21a939b51242680a0583472c92539e0` |
| libraryAdmissions | 4 | `86f91d6fd746bf3444e08f22f4d81d72db04477091f78724399090b6f3a28ddc` |
| publishedMemory | 4 | `552231791faefdc7cd8aff838671222e3195780f74974d4e699e31f2ed23bd65` |
| platformReadModels | 46 | `15d1d4a1201b4bb422284aef3965bbd074e14c19d4ea12026fd4e43f90893aaf` |
| searchDocuments | 46 | `d4919d3fa47be1df2ef92ac6fcddf237f88bda8ca772174005d73a8dac2bb173` |
| sitemapDocuments | 46 | `7d62a69145c8561279938c45b49a58b8f7695549dfde178a99e8180fe0030aef` |

Protected-state parity: `true`.

## 15. Configuration and discovery

Configuration remained `SHADOW`, `killSwitch=false`, `publicationEnabled=false`, `governanceSubmissionEnabled=false`, and `autonomousDiscoveryEnabled=false`. The tuple remained `.13 / .5 / .11 / .8`. Discovery remained `PAUSED`.

## 16. Files modified in this remediation

- `functions/src/factory-v2/authority.ts`
- `functions/src/factory-v2/identity.test.ts`
- `functions/src/factory-v2/orchestrator.ts`
- `functions/src/factory-v2/reliability.ts`
- `functions/src/factory-v2/reliability.test.ts`
- `scripts/forensics-evidence-authority.ts`
- `scripts/run-evidence-first-acquisition-canary.ts`
- Preserved forensic, canary, and program-report artifacts under `artifacts/` and `docs/programs/`.

Other dirty files predate this narrow remediation and remain part of the uncommitted TL-EVIDENCE-FIRST-GENERATION-001 implementation.

## 17. Git state

The worktree is dirty and uncommitted. No commit, push, merge, deployment, or destructive cleanup occurred. The unrelated untracked `docs/.DS_Store` remains untouched.

## 18. Complete five-subject acquisition status

Not pass. Earthquake, Berlin, and Ada remain passes from the preserved sequence. Printing Press still lacks a valid CKS. Olympic Games remains unexecuted.

## 19. Frozen 30-subject SHADOW certification

Restarting it is **not justified** and was not attempted. The authoritative certification state remains `NOT_SHADOW_CERTIFIED`. Further remediation or canary execution requires separate founder authorization.

Canonical targeted-run report: `artifacts/evidence-first-acquisition-canary/b8325d96797746f4e969f08423648059d9e2f6a5cbfa5a7b0aa55b2855530c7a/report.json` (SHA-256 `73d967d45d046e013f69f557cabb1631c8c0369a8c302da93fd2a5faa696eacd`).
