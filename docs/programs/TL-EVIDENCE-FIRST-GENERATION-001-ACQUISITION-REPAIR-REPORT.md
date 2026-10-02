# TL-EVIDENCE-FIRST-GENERATION-001 — Acquisition Repair and Canary Report

Date: 2026-09-09

## 1. Decision

`NOT_READY_FOR_SHADOW`

The acquisition-only canary stopped at the first failed subject, as authorized. Three subjects produced valid Completed Knowledge Sets. The fourth, **The Development of the Printing Press**, failed closed in initial acquisition with `NO_SUPPORTED_CLAIMS,NO_RESOLVED_EVENT_CANDIDATES`. The fifth subject was not executed. The frozen 30-subject certification was not rerun, and its authoritative verdict remains `NOT_SHADOW_CERTIFIED`.

## 2. Authorization boundary preserved

- No comparative selection, Event Lock, composition, Timeline Quality, final Source Authority, reader, Governance, Library, Published Memory, projection, search publication, sitemap publication, or public timeline step ran.
- The frozen corpus, frozen protocol, thresholds, institutional gates, and downstream selection behavior were not changed.
- No commit, push, merge, deployment, public certification, or autonomous-discovery resumption occurred.
- `EVIDENCE_FIRST_MODE=SHADOW`; publication, Governance submission, and autonomous discovery remained false; discovery remained `PAUSED`.

## 3. Original five-subject forensic trace

| Subject | Run operation | Observed acquisition result | Root-cause evidence |
|---|---|---|---|
| 1906 San Francisco Earthquake | `20253436-aafd-4fa6-a0a1-e8f5e6a2a5ae` | 4 sources, 19 claims, 0 supported, 0 entities/events | 18 claim edges relied on prohibited Wikipedia evidence; remaining evidence was unavailable or unclassified. Discovery and extraction occurred, but admission/authority starved construction. |
| Chernobyl Disaster | `eb5dca07-b74a-42dd-9f5f-a656209205fc` | 7 sources, 46 claims, 0 supported | 28 Wikipedia-excluded edges and 18 weak-authority edges; Britannica was unavailable. The pool lacked sufficient admitted direct institutional or independent scholarly evidence. |
| Great Smog of London | `b6ecb1b0-12fe-4cd9-99c6-39858c7f0574` | 4 sources, 13 claims, 0 supported | Wikipedia dominated, Britannica was unavailable, and the remaining repository/general source set did not meet claim burdens. |
| Berlin Blockade and Airlift | `163678b3-dc7e-4b75-8424-c6cb173c6ace` | V2-A produced 5 sources, 42 claims, 19 supported, 5 entities, 12 events | Acquisition actually succeeded. Strict reconstruction rejected Firestore's repository-level top-level `id`, which was not part of the semantic artifact schema. |
| Rwandan Genocide | `7fa044f7-ab9a-4b3f-b119-22f266cf9d6f` | 4 sources, 44 claims, 0 supported | Three Wikipedia sources plus unavailable Britannica left no admissible evidence. A robots denial resolved to a Google redirect chunk declaring `umn.edu`; it was a retrieval diagnostic, not evidence of absent extraction. |

The Berlin HTTPS warning similarly resolved to a Google redirect chunk declaring `ucsd.edu`. Across the five, the systemic classes were (a) authority starvation caused by weak/prohibited initial admission and insufficient viable alternatives, (b) repository document-ID contamination during strict hydration, and (c) failure wrappers that discarded stage diagnostics and provider usage.

## 4. Repair implemented

- Strict hydration now removes only the repository-injected document `id` before parsing every evidence-first artifact; semantic payload validation remains strict.
- Provider claim proposals contain semantic content only. Server-owned subject/object identifiers default to null, and a provider semantic event cluster key is deterministically hashed into the server-owned candidate cluster identity.
- Initial source admission excludes prohibited orientation-only sources before retrieval, prioritizes three distinct authoritative domains, and retains bounded viable alternatives.
- The bounded publisher registry now covers the directly relevant authoritative institutions; controlled `.gov`, `.gov.uk`, `.edu`, `.ac.uk`, and `.int` namespaces receive policy-owned publisher identity without inferring historical truth from the namespace.
- Existing claim burdens, direct-evidence checks, independence/corroboration rules, sensitive-claim handling, and final institutional Source Authority remain unchanged.
- Failure telemetry now preserves retrieval rejection reasons, claim rejection reasons, authority verdict distribution, event dispositions and rejection diagnostics, provider calls/queries, stage latency, token usage, and cost-measurement availability.
- Protected-state proof now uses bounded pagination and exact canonical content hashes, not counts alone.
- Scheduler state is read through application-default credentials and the read-only Scheduler API.
- A dedicated runner hardcodes exactly five sequential acquisition-only canaries, stops after the first failure, and cannot invoke comparative selection.

## 5. Tests added or expanded

Coverage includes repository-ID stripping; provider-owned versus server-owned identity; provider extra/malformed/empty responses; prohibited-source exclusion; inaccessible/robots-denied alternatives; controlled namespace identity; bounded authority registry; exact protected-state hashes; canary boundary behavior; and updated emulator fixtures.

## 6. Canary release identity

- Generation release: `ef51cba3bc1c94a79a432b38d8e944eeced6fc891556a32d47680574d4620fc2`
- Source revision: `c458062fc02eec6aeef70c6a7ffbc812aa019767`
- Source tree SHA-256: `7f812fe4353c5d6dbf89f3816eb0df70515cce959a66e5fe01b2bed06f7db8a4`
- Configuration bundle SHA-256: `1519c353844e86a9cab9f5e43c86ccd32f1831cdc60266566b80b20e4d5353b0`
- Knowledge tuple: `factory-v2-a.13 / factory-v2-a.5 / evidence-first-v2-a.11 / factory-v2-a-prompts.8`

## 7. Exact canary outcomes

| # | Subject | Outcome | CKS / terminal reason |
|---:|---|---|---|
| 1 | The 1906 San Francisco Earthquake | PASS | `completed-knowledge-set-5873a4f619fb55b4190bdbcc0fe38adca71b910f4a5637fd3a1a2458928cb12a` |
| 2 | The Berlin Blockade and Airlift | PASS | `completed-knowledge-set-ddaf4b01400b36329063b5a8ac16866dcc44308438821a12853f6e92cd2e96f1` |
| 3 | Ada Lovelace: Life and Work | PASS | `completed-knowledge-set-3d92d8b6f7109ea137279aa3b2c361a94dbe9d4a28df7c4fc46d32fe0cb3aad3` |
| 4 | The Development of the Printing Press | FAIL CLOSED | `INITIAL_ACQUISITION`: `NO_SUPPORTED_CLAIMS,NO_RESOLVED_EVENT_CANDIDATES` |
| 5 | The History of the Olympic Games | NOT EXECUTED | Suppressed after the first failure |

Result: 3 valid CKS out of the required 5. Therefore the only permitted verdict is `NOT_READY_FOR_SHADOW`.

## 8. Acquisition metrics

| Subject | Calls | Rounds | Discovered | Retrieval | Packets | Extracted | Supported | Resolved events | Latency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Earthquake | 17 | 1 | 94 | 11/12 | 8 | 27 | 27 | 5 | 323,891 ms |
| Berlin | 17 | 1 | 81 | 12/12 | 8 | 39 | 38 | 6 | 375,870 ms |
| Ada Lovelace | 26 | 2 | 147 | 34/38 | 14 | 63 | 52 | 6 | 690,523 ms |
| Printing Press | 16 | 1 | 75 | 10/12 | 7 | 40 | 0 | 0 | 370,144 ms |

Across executed subjects: 76 provider calls, 397 discovered sources, 67 successful retrievals from 74 attempts, 37 evidence packets, 169 extracted claims, 117 supported claims, and 17 resolved event candidates. Retries were zero; each executed subject used one semantic repair. Monetary cost was unavailable and is explicitly recorded as `NOT_MEASURABLE`.

## 9. Failure taxonomy and remaining defect

Printing Press was not a provider transport or schema failure. Ten source documents were retrieved and 40 claims were extracted, but all 40 authority verdicts were `INSUFFICIENT`. Consequently, all 28 attempted event cores reported `NO_SUPPORTED_CORE_CLAIM`, and no coverage audit or CKS could be constructed. Retrieval also recorded one robots denial and one bounded timeout. This demonstrates a remaining topic-general source-authority/admission weakness for long-duration technology histories. Per authorization, it is preserved without remediation or rerun.

## 10. Protected-state zero-write proof

Every protected collection had identical count and content hash before and after:

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

## 11. Runtime safety state

- Operating mode: `SHADOW`
- Kill switch: `false`
- Publication enabled: `false`
- Governance submission enabled: `false`
- Autonomous discovery enabled: `false`
- Scheduler: `PAUSED`
- No public routing or institutional authority boundary change was introduced.

## 12. Repository verification

- Functions: 177 discovered; 175 passed; 0 failed; 2 emulator-only skipped.
- Functions strict typecheck: passed.
- Functions TypeScript build: passed.
- Root strict typecheck: passed.
- ESLint: passed.
- Next.js production build: passed.
- `git diff --check`: passed.
- Deployment script shell syntax: passed.

## 13. Frozen certification and downstream metrics

The frozen 30-topic certification was not rerun. Selection, Event Lock, composition, Timeline Quality, final Source Authority, reader, and Governance metrics are therefore intentionally absent from this acquisition-only canary and must not be inferred. The prior `NOT_SHADOW_CERTIFIED` evidence remains authoritative and unchanged.

## 14. Human-style inspection

No composed timeline was produced by this acquisition-only protocol, so no reader-level product inspection was authorized or possible. The acquired knowledge artifacts were evaluated only for valid CKS completion.

## 15. Git state

The working tree remains intentionally uncommitted and contains the broader TL-EVIDENCE-FIRST-GENERATION-001 implementation plus this repair, tests, runners, and preserved evidence. An unrelated untracked `docs/.DS_Store` remains untouched. No commit or remote mutation occurred.

## 16. Checkpoint readiness

**Not ready to checkpoint as a shadow-certification candidate.** The implementation and tests are repository-clean in behavior, and three canaries prove the core repair materially works, including the former Berlin reconstruction defect. However, the required 5/5 acquisition proof failed, a remaining authority/admission defect is preserved, and behavior-affecting contract changes require an explicit versioning/review decision before any future checkpoint.

## 17. Public Editorial Excellence certification

**Not justified.** Evidence-First Generation remains `NOT_SHADOW_CERTIFIED`; Editorial Excellence remains `NOT_CERTIFIED`.

## 18. Required next authority

Stop here for founder review. Any diagnosis-to-remediation change, version-tuple change, additional canary, frozen shadow rerun, checkpoint, commit, deployment, public certification, or discovery resumption requires separate authorization.

The canonical machine-readable canary evidence is `artifacts/evidence-first-acquisition-canary/ef51cba3bc1c94a79a432b38d8e944eeced6fc891556a32d47680574d4620fc2/report.json`.
