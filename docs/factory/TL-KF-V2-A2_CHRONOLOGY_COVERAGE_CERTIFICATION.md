# TL-KF-V2-A2 chronology coverage certification

Status: IN PROGRESS  
Execution boundary: non-public SHADOW only  
Starting checkpoint: `5f3df29e6ca43c9236d18b02bc0c1b6ad4fcf88e` on `codex/tl-content-reset-001`

## Authorized correction

TiMELiNES outputs are chronological timelines, so every supported V2-A Scope Contract topic class requires chronological event evidence. Software now prepends one immutable, date-critical Research Map question derived only from the locked title and temporal boundary. It also reserves the existing `ORIENTATION` query slot for one deterministic authority-oriented chronology query. Gemini can add breadth but cannot remove or replace either artifact.

The total execution ceiling remains five searches: one software chronology-orientation query, up to three model phase/dimension queries, and up to one model authority-targeted query. No grounding, provider-query, source, claim, repair, concurrency, or worker budget increased. Source retrieval, Publisher Authority, claim-level Source Authority, conflict handling, date precision, and canonical EVENT requirements are unchanged.

Software provenance is explicit in the content-addressed namespaces `software-chronology-question-*` and `software-chronology-query-*`, and in `RESEARCH_QUESTION_COVERAGE` audit details as `SOFTWARE_GENERATED`. No historical milestone, entity assertion, domain whitelist, or Apollo-specific fact is hardcoded.

## Version bundle

The interrupted checkpoint operation already occupied pipeline `.9`, policy `.8`, and prompt `.7`. To avoid reinterpreting retained immutable artifacts, this coherent successor uses:

- pipeline: `factory-v2-a.10`
- schema: `factory-v2-a.3` (unchanged; no persisted schema shape changed)
- policy: `evidence-first-v2-a.9`
- prompt: `factory-v2-a-prompts.8`

The mutable SHADOW configuration was migrated from `.8` to `.10` using compare-and-set after all local gates passed. The transaction rechecked SHADOW mode and all three disabled capability flags.

## Starting safety evidence

Before implementation:

- branch, local HEAD, upstream, and remote were equal at the checkpoint commit;
- `main` equaled `origin/main` at `36c0ba7bc587cc1f40caab20e203c596395241da`;
- rollback tag `pre-tl-kf-v2-a` resolved to `a925c456d4bf41fd2fdca458d9f7256a4f06244b`;
- worktree was clean and contained no `.DS_Store`;
- `factoryV2/config` was SHADOW `.8/.3/.7/.6`, with publication, Governance submission, and autonomous discovery disabled;
- `topic-discovery-daily` was PAUSED;
- zero V2 operations were RUNNING;
- zero Published Memory and zero public projection records carried a `factory-v2-a*` pipeline;
- Cuban Missile Crisis and Apollo 13 remained `AWAITING_REVIEW / governance_review` at their preserved timestamps;
- the 46-record public projection baseline hash was `569d2497578181295d06c828bceaa28d9afce93cae330d30d51699c1cead406d`.

## Local verification

Focused V2-A tests: 49/49 PASS. The focused cases cover deterministic presence and stable identity, derivation from locked temporal scope, model replacement resistance, all five supported topic classes, the unchanged five-query ceiling, reserved chronology execution, version pinning, normal Source Authority failure behavior, date-precision preservation, locked Research Map completion, and compatible retrieval/cache behavior.  
Firestore emulator/security/integration: 3/3 PASS using the installed OpenJDK 17 runtime.  
Functions typecheck: PASS.  
`git diff --check`: PASS.

## Apollo Gate 1

PASS. Exactly one fresh Apollo 11 fixture ran under the new bundle.

- operation: `a34a458f-2247-4c72-a2cb-31f221f24db9`
- runtime: 286,385 ms
- model calls: Scope 1, Research Map 2 (one bounded repair), Query Plan 1, claim extraction 8
- grounding calls / provider-reported searches: 5 / 20
- discovered / attempted / successful retrievals: 41 / 8 / 6
- durable unique snapshots: 5; cache hits 0, revalidated 1, refetched 1, not applicable 4
- safely isolated retrieval failures: 2 (robots denial and aborted fetch)
- evidence packets / exact segments: 8 / 81
- extracted / supported claims: 12 / 4
- supported dated occurrence claims: 4, at day precision on July 16, July 20, and July 24, 1969
- canonical EVENT candidates: 4, all RESOLVED
- entity candidates / resolved entities: 2 / 2
- conflicts: 1 preserved unresolved non-blocking set; 0 blocking conflicts
- non-event canonical items: 0; non-event eligibility rules remained unchanged and passed focused/emulator tests
- Firestore / private archive writes: 583 / 4
- input / output tokens: 415,885 / 11,855
- monetary cost: not measurable from available telemetry; no precise cost is asserted

The persisted Research Map contains exactly one `software-chronology-question-*` question, marked CRITICAL/date-critical, bound to all available locked Apollo phases/dimensions, and audited as `SOFTWARE_GENERATED`. Its audit status is `SUFFICIENT` with one evidence job and four extracted claims. The Query Plan contains exactly five queries; the reserved `software-chronology-query-*` ORIENTATION query occupies one existing slot. The operation closed `COMPLETED / PASS` with no blocking reason, remained non-publishable, and created no Governance submission or public projection.

## Final uniform suite

Authorized by the audited Apollo Gate 1 PASS and executed exactly once, sequentially, with a hard stop prepared after every fixture. No code or configuration changed during the suite.

- `CERTIFICATION_CANDIDATE_COMMIT`: `d0f495b134cd11f96c533a17af525cce24e8d715`
- `VERSION_BUNDLE`: pipeline `.10`, schema `.3`, policy `.9`, prompt `.8`
- `CONFIG_HASH`: `74f7c68c70a612300a7c855f9fc51b02d7dbbe85b0a5299eedf1bcaaf926c8e2`

| Fixture | Operation | Runtime | Search / retrieval | Cache | Claims | Knowledge result |
|---|---|---:|---|---|---|---|
| History of the World Wide Web | `8b40de60-ad95-4d74-886c-1ffb0e1e585d` | 407,399 ms | 5 grounding; 22 provider queries; 8/8 retrievals | 1 hit; 4 revalidated; 1 refetched | 36 extracted; 24 supported | 11 resolved EVENTS; 0 non-events; PASS |
| Fall of the Berlin Wall | `0fd335bd-d594-4f55-9c94-b3239736a430` | 358,890 ms | 5 grounding; 20 provider queries; 8/8 retrievals | 0 hits; 2 revalidated; 2 refetched | 32 extracted; 6 supported | 6 resolved EVENTS; 0 non-events; PASS |
| Apollo 11 Mission | `806748fe-0b15-4947-8ebf-3ddc28ffb66d` | 297,156 ms | 5 grounding; 17 provider queries; 5/6 retrievals | 1 hit; 1 revalidated; 1 refetched | 18 extracted; 6 supported | 2 resolved EVENTS; 0 non-events; PASS |
| Cuban Missile Crisis | `2ec96d0c-9109-48b3-b987-f30c565a0dd4` | 459,234 ms | 5 grounding; 22 provider queries; 7/8 retrievals | 0 hits; 5 revalidated; 0 refetched | 34 extracted; 34 supported | 5 resolved EVENTS; 14 CONTEXT items; PASS |
| Apollo 13 Mission | `19b1fbad-540c-4071-8b57-53398fc2a2b7` | 423,263 ms | 5 grounding; 19 provider queries; 7/8 retrievals | 2 hits; 0 revalidated; 0 refetched | 47 extracted; 41 supported | 4 resolved EVENTS; 2 CONTEXT items; PASS |

All five operations closed `COMPLETED / PASS`, carried exactly one software chronology question/query, used exactly five bounded grounding calls, preserved exact bundle identity, produced at least one meaningful canonical EVENT candidate, remained below 600 seconds, and left no RUNNING residue. Three source failures were safely isolated (two robots denials and one aborted retrieval). All recorded conflicts were preserved; none was material/blocking.

The software chronology coverage audit was `SUFFICIENT` for Berlin, Apollo 11, and Cuban; `PARTIAL` for Apollo 13; and `NO_EVIDENCE` for Web. The Web chronology query still executed in its reserved slot, while other bounded questions produced five supported dated occurrences and 11 resolved EVENTS. Therefore the software minimum path was present and non-removable in every fixture without asserting that one query must always succeed.

Raw immutable fixture records:

- `artifacts/factory-v2/v2-a-shadow-fixtures-1788684054139.json`
- `artifacts/factory-v2/v2-a-shadow-fixtures-1788684422666.json`
- `artifacts/factory-v2/v2-a-shadow-fixtures-1788684727559.json`
- `artifacts/factory-v2/v2-a-shadow-fixtures-1788685194674.json`
- `artifacts/factory-v2/v2-a-shadow-fixtures-1788685625911.json`

## Reader/editorial inspection

PASS. The bounded inspection sampled supported claims, event candidates, dates, exact segment provenance, source identities/classes, conflicts, and non-event candidates for every fixture.

- Web acquired CERN-backed 1989 proposal, 1990 implementation, 1991 release, 1993 public-domain, and 1994 institutional chronology. Candidate labels remain pre-composition and are not final Timeline View prose.
- Berlin acquired IWM-backed peaceful demonstrations, Schabowski's 9 November announcement, the Wall opening, and 10 November crowds with month/day precision preserved.
- Apollo 11 acquired NASA-backed launch, lunar-surface, and splashdown chronology; separate DATE and OCCURRENCE claims correctly combined only through supported candidate clusters.
- Cuban acquired NARA/JFK Library-backed reconnaissance, ExComm, public address, and 16–28 October crisis chronology; 14 contextual items remained non-events.
- Apollo 13 acquired NASA review-board and Britannica evidence for the accident response and recovery chronology; pre-launch tank-service material remained contextual rather than silently expanding the mission-event scope.

The engine acquired historically relevant candidate knowledge rather than merely satisfying schemas. V2-A does not certify final 10–20-event selection, candidate naming, or reader-facing composition; those remain V2-B responsibilities.

## Performance and cost

Per-topic runtime was 297,156–459,234 ms. The five-run p50 was 407,399 ms (6m47.399s). With five samples, nearest-rank p95 is approximated by the maximum: 459,234 ms (7m39.234s). This leaves approximately 12m20.766s within the future end-to-end 20-minute target for V2-B and downstream work; no performance optimization was attempted after the suite froze.

Across the suite: 87 persisted model executions (25 grounding, 40 claim extraction, 5 Scope executions, 10 Research Map executions, and 7 Query Plan executions), 100 provider-reported search queries, 38 direct retrieval attempts, 35 successes, 4 cache hits, 12 revalidations, 4 refetches, 40 claim packets, 111 supported claims, 28 resolved EVENTS, 16 non-event items, 2,798 Firestore writes, and 3 private archive writes. Token telemetry recorded 1,969,828 input and 114,290 output tokens. Provider billing telemetry was unavailable, so monetary cost remains `NOT_MEASURABLE`; no precise cost is invented.

## Regression and security gates

PASS:

- focused V2-A: 49/49;
- Firestore emulator/security/integration: 3/3;
- Functions regressions: 91/91;
- root regressions: 249/249 when run alone (an initial concurrent run produced one timer-sensitive lease-heartbeat miss at 248/249; the unchanged test passed in the isolated required gate);
- editorial certification: 68/68;
- Historical Library: 7/7;
- Published Memory: 7/7;
- Projection Engine: 7/7;
- Search: 8/8;
- Platform: 8/8;
- root and Functions typechecks, ESLint, Functions build, Next production build, and `git diff --check`;
- production dependency audits: zero high and zero critical findings in both packages; eight known moderate transitive findings in each, with breaking downgrade recommendations intentionally not applied.

The focused security tests and unchanged retrieval implementation confirm HTTPS-only retrieval, DNS/IP SSRF and private-network blocking, TLS, robots enforcement, bounded redirects/time/size/content types, safe extraction, prompt-injection isolation, private archive storage, and server-only Firestore writes. Live safe-failure classifications demonstrate that blocked/unavailable sources do not bypass these controls.

## Final production integrity

PASS. The final read-only audit found:

- SHADOW `.10/.3/.9/.8` config and unchanged config hash;
- publication, Governance submission, and autonomous discovery disabled;
- `topic-discovery-daily` PAUSED;
- zero RUNNING V2 operations;
- zero V2 Published Memory records and zero V2 public projections;
- unchanged four-record Published Memory and 46-record public projection inventory;
- unchanged public projection hash `569d2497578181295d06c828bceaa28d9afce93cae330d30d51699c1cead406d`;
- Cuban Missile Crisis and Apollo 13 production topic/job records still `AWAITING_REVIEW / governance_review` at their original timestamps;
- `main` and `origin/main` unchanged at `36c0ba7bc587cc1f40caab20e203c596395241da`;
- rollback tag `pre-tl-kf-v2-a` intact.

## Verdict

**TL-KF-V2-A: CERTIFIED**

V2-B is authorized for implementation but was not begun. Autonomous discovery remains paused. V2 publication and Governance submission remain disabled.
