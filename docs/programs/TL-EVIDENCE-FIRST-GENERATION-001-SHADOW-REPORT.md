# TL-EVIDENCE-FIRST-GENERATION-001 — SHADOW Report

## Verdict

`NOT_SHADOW_CERTIFIED`

Recorded on 2026-09-09. The frozen run was stopped under the protocol's systematic provider/system-defect exception after 5 of 30 subjects. Four subjects across two topic classes independently failed initial acquisition with `NO_SUPPORTED_CLAIMS,NO_RESOLVED_EVENT_CANDIDATES`; a fifth reached retrieval but failed the strict acquisition contract because the provider result contained the unrecognized top-level key `id`. Four acquisition failures already exceeded the frozen maximum of three failures for the required 27/30 Completed Knowledge Set threshold, making certification mathematically impossible. No threshold was changed.

## Configuration and guarded update

- Firestore document: `factoryV2/config`
- Before tuple: `factory-v2-a.11 / factory-v2-a.3 / evidence-first-v2-a.10 / factory-v2-a-prompts.8`
- After tuple: `factory-v2-a.13 / factory-v2-a.5 / evidence-first-v2-a.11 / factory-v2-a-prompts.8`
- Guard: one transactional compare-and-set required the exact complete old tuple. It succeeded; no reconciliation or unrelated update was performed.
- Before and after safety state: `operatingMode=SHADOW`, `killSwitch=false`, `publicationEnabled=false`, `governanceSubmissionEnabled=false`, `autonomousDiscoveryEnabled=false`.
- Discovery scheduler before and after: `PAUSED`.

## Frozen identities

- Corpus SHA-256: `4c12c5a725aeeb7ac62d901c149ec83f23b7293a5f425b623913c13b577be3b8`
- Protocol/threshold SHA-256: `8bcf30460f61b26b4039235140b3f869766ca559a3b7736addf7fb2250bf58ab`
- Generation release ID: `39be12ace94725f624d5a2f0693a3c61086242798104b22cd865d15e82c6e1e9`
- Source revision: `c458062fc02eec6aeef70c6a7ffbc812aa019767`
- Source tree SHA-256: `0ecd657670d8531f53cdf91051d1f8b1b2873a3a9451ea2d07db831e937e0a4e`
- Configuration bundle SHA-256: `1519c353844e86a9cab9f5e43c86ccd32f1831cdc60266566b80b20e4d5353b0`

## All frozen-subject outcomes

| # | Subject | Class | Outcome | Terminal evidence |
|---:|---|---|---|---|
| 1 | The 1906 San Francisco Earthquake | bounded episode | FAILED_CLOSED | Initial acquisition: no supported claims or resolved event candidates; 255,863 ms |
| 2 | The Chernobyl Disaster | bounded episode | FAILED_CLOSED | Initial acquisition: no supported claims or resolved event candidates; 353,447 ms |
| 3 | The Great Smog of London | bounded episode | FAILED_CLOSED | Initial acquisition: no supported claims or resolved event candidates; 206,753 ms |
| 4 | The Berlin Blockade and Airlift | crisis/conflict | FAILED_CLOSED | Strict schema rejected provider top-level `id`; 429,177 ms |
| 5 | The Rwandan Genocide | crisis/conflict | FAILED_CLOSED | Initial acquisition: no supported claims or resolved event candidates; 333,945 ms |
| 6 | The Partition of India | crisis/conflict | NOT_EXECUTED | Systematic-defect stop condition |
| 7 | Ada Lovelace: Life and Work | biography | NOT_EXECUTED | Systematic-defect stop condition |
| 8 | Toussaint Louverture: Life and Revolution | biography | NOT_EXECUTED | Systematic-defect stop condition |
| 9 | Wangari Maathai: Life and Environmental Leadership | biography | NOT_EXECUTED | Systematic-defect stop condition |
| 10 | Ibn al-Haytham: Life and Scientific Work | biography | NOT_EXECUTED | Systematic-defect stop condition |
| 11 | The History of the United Nations | institution | NOT_EXECUTED | Systematic-defect stop condition |
| 12 | The History of the Royal Society | institution | NOT_EXECUTED | Systematic-defect stop condition |
| 13 | The History of the International Red Cross and Red Crescent Movement | institution | NOT_EXECUTED | Systematic-defect stop condition |
| 14 | The Development of the Printing Press | technology | NOT_EXECUTED | Systematic-defect stop condition |
| 15 | The Development of the Electric Telegraph | technology | NOT_EXECUTED | Systematic-defect stop condition |
| 16 | The Development of the Transistor | technology | NOT_EXECUTED | Systematic-defect stop condition |
| 17 | The Development of Container Shipping | technology | NOT_EXECUTED | Systematic-defect stop condition |
| 18 | The Development of Germ Theory | scientific development | NOT_EXECUTED | Systematic-defect stop condition |
| 19 | The Development of Plate Tectonics | scientific development | NOT_EXECUTED | Systematic-defect stop condition |
| 20 | The Discovery of DNA Structure | scientific development | NOT_EXECUTED | Systematic-defect stop condition |
| 21 | The Discovery of Nuclear Fission | scientific development | NOT_EXECUTED | Systematic-defect stop condition |
| 22 | The History of Abolitionism | cultural/intellectual movement | NOT_EXECUTED | Systematic-defect stop condition |
| 23 | The Harlem Renaissance | cultural/intellectual movement | NOT_EXECUTED | Systematic-defect stop condition |
| 24 | The Enlightenment | cultural/intellectual movement | NOT_EXECUTED | Systematic-defect stop condition |
| 25 | The Global Decolonization Movement | cultural/intellectual movement | NOT_EXECUTED | Systematic-defect stop condition |
| 26 | The History of the Olympic Games | long-duration subject | NOT_EXECUTED | Systematic-defect stop condition |
| 27 | The History of the Silk Roads | long-duration subject | NOT_EXECUTED | Systematic-defect stop condition |
| 28 | The History of Money | long-duration subject | NOT_EXECUTED | Systematic-defect stop condition |
| 29 | The History of Internet Governance | ongoing subject | NOT_EXECUTED | Systematic-defect stop condition |
| 30 | The Development of Climate Change Science | ongoing subject | NOT_EXECUTED | Systematic-defect stop condition |

## Metrics against frozen thresholds

- Executed: 5/30; failed closed: 5/5; not executed under stop condition: 25/30.
- Completed Knowledge Sets: 0/30 (required at least 27).
- Evidence-eligible sets: 0/30 (required at least 27).
- Comparative selection passes: 0/30 (required at least 27).
- Event Lock plus constrained composition passes: 0/30 (required at least 27).
- Timeline Quality passes: 0/30 (required at least 27).
- Source Authority passes: 0/30 (required at least 27).
- Reader passes: 0/30 (required at least 27).
- End-to-end passes: 0/30 (required at least 26).
- Publication-worthy products: 0. Consequently there were no generated timelines eligible for reader-level human inspection.
- Executed latency: median 333,945 ms; p95/max 429,177 ms; all five were below the 1,200,000 ms worker ceiling.
- Class results: bounded episode 0/3; crisis/conflict 0/2 executed plus 1 not executed; every other class 0 executed. The per-class 75% threshold failed.
- Acquisition failure taxonomy: repeated zero-evidence result 4; strict provider/schema mismatch 1; HTTPS-required retrieval warning 1; robots-denied retrieval warning 1.
- Provider reliability/usage: the failure wrapper retained terminal latency and failure reasons but did not retain attempts, tokens, query counts, or per-call usage. Monetary cost was not measurable. This is an instrumentation deficiency and independently blocks certification.

## 001D regression and human-style inspection

- San Francisco Earthquake: executed; no product was generated. Inspection confirms failure occurred before Completed Knowledge Set construction, selection, Event Lock, Timeline Quality, Source Authority, and reader review. Regression failed.
- Ada Lovelace: not executed because the systematic-defect stop condition had already been met. Regression not demonstrated.
- Olympic Games: not executed because the systematic-defect stop condition had already been met. Regression not demonstrated.
- No topic produced a publication-worthy timeline. Therefore detailed prose/date/source inspection could not be performed for a generated product, and the required cross-class human inspection could not be satisfied.

## Zero-write and post-run safety evidence

Protected collection counts were identical before and after:

| Collection | Before | After | Delta |
|---|---:|---:|---:|
| governancePackages | 8 | 8 | 0 |
| governanceDecisions | 4 | 4 | 0 |
| governanceQueues | 4 | 4 | 0 |
| libraryAdmissions | 4 | 4 | 0 |
| publishedMemory | 4 | 4 | 0 |
| platformReadModels | 46 | 46 | 0 |
| searchDocuments | 46 | 46 | 0 |
| sitemapDocuments | 46 | 46 | 0 |

This proves zero count deltas for Governance, Historical Library, Published Memory, public projection/search/sitemap state. The preflight implementation did **not** capture content hashes for these collections before execution. Therefore content-level unchanged-state proof cannot be asserted from this run, even though counts remained unchanged and the SHADOW implementation has no protected-write dependency. This execution-integrity failure is preserved rather than retroactively repaired.

No public timeline was created, no Governance submission or decision was created, no Historical Library admission occurred, no Published Memory entry or public projection was created, no deployment occurred, and autonomous discovery remains `PAUSED`.

## Repository verification

- Root tests: 249 passed, 0 failed.
- Functions tests: 169 passed, 0 failed, 2 emulator-only skips (171 discovered).
- Editorial Intelligence: 68 passed, 0 failed.
- Historical Library: 7 passed, 0 failed.
- Published Memory: 7 passed, 0 failed.
- Projection Engine: 7 passed, 0 failed.
- Search: 8 passed, 0 failed.
- Platform: 8 passed, 0 failed.
- Root and Functions strict typechecks: passed.
- ESLint: passed.
- Functions TypeScript build: passed.
- Next.js production build: passed.
- `git diff --check`: passed before execution.
- Deploy script shell syntax: passed.
- Dependency audit at high severity threshold: passed. Root reports 1 low and 8 moderate transitive advisories; Functions reports 8 moderate transitive advisories. The available complete fixes require breaking dependency changes and were not applied during certification.

## Founder decision posture

- Implementation ready to checkpoint: **No**. The candidate is deterministic and test-clean, but the live acquisition/provider contract is not certification-ready and protected content-hash instrumentation is incomplete.
- New public Editorial Excellence certification justified: **No**.
- Required disposition: preserve this evidence for founder review. Do not begin remediation, public certification, commit, push, merge, deployment, or autonomous-discovery resumption without separate authorization.
