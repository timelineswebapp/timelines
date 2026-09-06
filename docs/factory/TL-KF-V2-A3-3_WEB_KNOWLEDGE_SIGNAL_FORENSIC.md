# TL-KF-V2-A3.3 — Web Knowledge-Signal Forensic Audit

## Verdict

The Web completion run produced no chronology-eligible event because source admission optimized publisher-registry status, requested source class, query role, diversity, and discovery order, but did not score exact gap/date/event relevance or exclude sources that downstream Source Authority categorically prohibits. The admitted evidence therefore consisted mainly of early Web history, current/state descriptions, weak-authority summaries, and Wikipedia event signal. Fifteen claims passed authority, but no supported claim cluster represented a discrete, historical, dated occurrence with the required entity linkage. The only resolved candidate was a 1993 traffic state and was correctly classified `STATE_LEGACY` / `INELIGIBLE`.

This is a read-only forensic conclusion. This audit made zero Vertex/Gemini calls, zero Grounding calls, zero source retrievals, and zero Firestore writes. It did not run either fixture, mutate configuration, alter B1/B2, publish, deploy, or resume discovery. All production reads cited below were against already-persisted artifacts.

## Baseline and evidence boundary

- Branch baseline: `codex/tl-content-reset-001` at `db7ec2b22db4cf4e322a14593a0b98b0338f765b`; it is a direct descendant of unchanged `main` / `origin/main` at `36c0ba7bc587cc1f40caab20e203c596395241da`.
- Rollback tag object: `a925c456d4bf41fd2fdca458d9f7256a4f06244b` (`pre-tl-kf-v2-a`).
- Forensic subject: run `v2-a3-web-98332efd-8842-490f-8ecd-d080d8789862`, created `2026-09-06T15:40:38.111Z`.
- Corpus/topic: `timelines-clean-2026-09-v1` / `36d6d69aa3bce5d0e65dbf435da523a49bec3035f7c0cc7a96a678c9e793c297`.
- Evidence sources: persisted corpus artifacts, repository code, and `artifacts/factory-v2/v2-a3-2-web-failure-1788709811712.json`. Evidence packets are not persisted as first-class artifacts; their membership and scores below were deterministically reconstructed from persisted questions and segments with the frozen `selectEvidencePacket` implementation. No missing evidence was regenerated.

## Complete pipeline trace

| Stage | Persisted identity / input | Output | Rejection, failure, or timing |
|---|---|---|---|
| Initial coverage audit | `knowledge-coverage-audit-170dd8eff25342130a52f44c320351dd35a18b7466110401739a80c3083362b6`; hash `fab119598f1786f91dfa61b9297ad26bf9313c0bb3c9bd229fed03369bb1aac3` | 7 gaps; latest chronology year 1994; `STALE_LOCKED_PHASE`; `KNOWLEDGE_COVERAGE_INSUFFICIENT` | `auditMs=18` |
| Completion planning | `knowledge-completion-plan-98966466eaeb5f4da56b0945f2b5477a170f507353864d9ddf8d3dbcc1782c11`; hash `26bef944ab28fbe551a57b5a0c7972889951c9cde1206aad01be86c304ba5a77` | 5 tasks; 0 unplanned material gaps | One round, five gap questions |
| Completion map | `research-map-34efed2ab3bbaa364138468c77d54998b5e303f9a13ac04fea2b8ef8695679ce` | Locked phases/dimensions plus 5 completion questions | Persisted |
| Query plan | `query-plan-8651cfea3876b6de820a936609c7c8447206b43321d66c453e7c0f0e2359e205` | 5 planned queries | Budgets: 5 Grounding calls, 25 provider queries, 30 source documents, 100 claims, 480 s; claim-extraction ceiling was omitted from this runtime budget bundle |
| Acquisition | 5 acquisition runs and 5 discovery artifacts | 25 provider-reported queries; 75 discovered chunks across all responses; 9 admitted/retrieved documents | All acquisition runs `ATTRIBUTABLE`; 5 Grounding executions |
| Retrieval/segmentation | 9 source cache decisions | 1 cache hit, 3 revalidations, 5 `CACHE_NOT_APPLICABLE`; 249 newly persisted segments plus reusable cached segments | TU Dublin snapshot `UNAVAILABLE` / `ACCESS_DENIED`; 9 documents still counted |
| Packet selection | Persisted segments + frozen `selectEvidencePacket` | 8 source-question packets submitted | No packet artifact exists. Lexical score favors question-term and central-entity overlap; a date adds only 4 points |
| Claim extraction/validation | 8 model executions, no semantic repair executions | 37 structurally valid atomic claims | Source cap was 6 claims per call; 8 packets exceeded intended maximum 5 extractions |
| Claim evidence | 42 `v2ClaimEvidence` edges | Direct evidence edges for all claims | Wikipedia edges marked `PROHIBITED`; unclassified EBSCO edges not strong enough |
| Source Authority | 37 verdicts | 15 `SUPPORTED`; 22 `INSUFFICIENT` | 16 `WIKIPEDIA_EXCLUDED` + `MISSING_EVIDENCE`; 6 `WEAK_AUTHORITY` + `MISSING_EVIDENCE` |
| Conflict detection | `claim-conflict-*` persisted set (1) | One nonblocking IRS visit-count conflict | Did not block an otherwise supported event |
| Entity resolution | 2 entity versions | CERN and HTML resolved | Exact central-entity matching did not resolve the W3C abbreviation for the TPAC cluster |
| Event resolution | `event-version-a8b109c943719ab973677987a3bbe5d41b98eedfe685b4c9b60301dd4d4edd9d` | 1 candidate, 0 chronology-eligible events | Candidate `8da339bb-7415-530c-bce9-9ae620f0a114`; `STATE_LEGACY`; `INELIGIBLE` |
| Final audit | `knowledge-coverage-audit-386ff51128d7c07514169f5756481928f2d6d557fc571014eac7a2bb306c5da7`; hash `e2571baab3bbf1d05301209d718ad17fe8fd991deff422d7a3a49786d9b48fac` | 8 gaps; latest chronology year still 1994; `STALE_LOCKED_PHASE`; insufficient | `auditMs=5` |
| Terminal operation | `v2TopicOperations/v2-a3-web-98332efd-8842-490f-8ecd-d080d8789862` | `FAILED`, stage `A5_RESOLUTION_REUSE`, blocker `NO_RESOLVED_EVENT_CANDIDATES` | Counts: sources 9, claims 37, supported 15, conflicts 1, entities 2, events 1; elapsed 359,286 ms |
| Completion result | Intended result at `scripts/factory-v2/run-v2a3-web.ts:99` | Not persisted | Zod `too_big`: `budgetConsumed.claimExtractions=8`, maximum 5 |

The persisted execution totals were 13 model calls (5 acquisition + 8 extraction), 22,180 input tokens, 18,884 output tokens, 48,090 total tokens, and 243,892 ms model latency. Cost was `NOT_MEASURABLE`. Those are historical run facts, not activity performed by this audit.

## Initial material gaps

The scope begins in 1989 (bounded 1980–1990) and is ongoing as of 2026-09-06. The five requested material phase/dimension gaps are below. Each had zero supporting claims and zero chronology-eligible events at the initial audit.

| Gap ID | Type | Locked phase/date or dimension | References | Exact persisted reason | State |
|---|---|---|---|---|---|
| `coverage-gap-46e85da405fce36fd2aa83edc1dd6190edad82f1800fbbf0b538a42252d6fc7d` | `MISSING_PHASE_KNOWLEDGE` | `phase-08b5d0a032c15f8c18f9f9dee3d3cbc7cf6c0c9e83483d5ec75104e0da499d54`, “Web 2.0 and Social Web (2000-2010)” | Phase | “Locked required phase \"Web 2.0 and Social Web (2000-2010)\" lacks sufficient authoritative chronology-eligible event knowledge.” | Chronology missing |
| `coverage-gap-d1a90be7280d9f0d9f2bfe6710719af7c9660e1e5ba06be9fb296b93d86fe1c4` | `MISSING_PHASE_KNOWLEDGE` | `phase-fbb3849428118bb8c696e985a981e0927e253601f09837e4e532491ea743a4b8`, “Mobile Web and Ubiquitous Access (2010-2020)” | Phase | “Locked required phase \"Mobile Web and Ubiquitous Access (2010-2020)\" lacks sufficient authoritative chronology-eligible event knowledge.” | Chronology missing |
| `coverage-gap-cebad8d2ebd77d0c5eee9eadb4042280486b54ae6c5b8aef5d88483571b88f41` | `MISSING_PHASE_KNOWLEDGE` | `phase-ba3bc90ddefd4611344f38dd31f1fd91ee9f24e3254786998154498a3b152c38`, “Current Trends and Future Directions (2020-Present)” | Phase | “Locked required phase \"Current Trends and Future Directions (2020-Present)\" lacks sufficient authoritative chronology-eligible event knowledge.” | Chronology missing and ongoing stale |
| `coverage-gap-817c64d798624101d51add5405abebe8b1bde8a89eae768ab3558aa355b2dda6` | `WEAK_DIMENSION_KNOWLEDGE` | `dimension-88958756bc60a8190e05b248a984b297ec07d85cdaa1b527b56abdaab9071175`, “Societal and Cultural Impact”; all phases | Dimension | “Locked required dimension \"Societal and Cultural Impact\" lacks sufficient authoritative knowledge.” | Weak: extracted knowledge existed but was not authoritative |
| `coverage-gap-bac4f1cabf0685d686ab1298216c1f520b79f251dec7383e53c3061729ba4d8a` | `MISSING_DIMENSION_KNOWLEDGE` | `dimension-e7e956d1b629fab67865369eccdb16a5d56ae79bed516bfa142fd46f29ef66ef`, “Economic Impact”; all phases | Dimension | “Locked required dimension \"Economic Impact\" lacks sufficient authoritative knowledge.” | Missing |

Two derivative gaps were also persisted: `coverage-gap-945d3708677aae68eefd38f5f869df80b1fe3f0dde5155a4e54afa7457b98f19` (`UNANSWERED_CRITICAL_RESEARCH_QUESTION`, the locked software chronology question) and `coverage-gap-a103ea2e0615f21d8a716fc7d9d491f32dc87f415ae90b8ddd295cf82871ff3a` (`STALE_ONGOING_SCOPE`). They explain why the audit gap count was seven; they are not additional phase/dimension gaps.

## Completion tasks and targeting

Each task had one Grounding-call budget unit. The shared provider-query ceiling was 25.

| Task / question | Origin | Phase/date; dimension | Intended authority | Persisted question | Forensic targeting assessment |
|---|---|---|---|---|---|
| `coverage-task-3521f7ad40471ad0592ead5b7d43527ba1e67f2059959dc0373499543e1026cb` / `coverage-question-e58ef050de3e54cf7073a262a7b3d56692dade071bdbee6f95ec6996b7f2d066` | Web 2.0 gap + chronology question | 2000–2010; Technological Development | `PRIMARY_INSTITUTIONAL` | “What authoritative dated evidence establishes material developments in the locked phase \"Web 2.0 and Social Web (2000-2010)\" ...?” | Date-aware but abstract “material developments”; not explicitly discrete occurrences, releases, decisions, or adoptions |
| `coverage-task-a0de7483ef3fd16739c5e2b8700ba2ddec847edd82fc1927aaba0e1704446789` / `coverage-question-b2dafc15db3866b74133dc23630452b966fce4b8a53809ed0bb73a6af1827597` | Mobile gap + chronology question | 2010–2020; Technological Development | `PRIMARY_INSTITUTIONAL` | Same construction for “Mobile Web and Ubiquitous Access (2010-2020)” | Date-aware, but “developments” invited standards state, features, and adoption trends |
| `coverage-task-c68c09265207614123b0999d77352c6fa89c6d65e50cf0f40a91fe1a1dbdfa70` / `coverage-question-e1864d4ed8dd309205bbb2520843edb925e8ad1b1a8213008856ea6912d2342f` | Current gap + chronology + stale gaps | 2020–Present; Technological Development | `PRIMARY_INSTITUTIONAL` | Same construction for “Current Trends and Future Directions (2020-Present)” | Phrase “future directions” invited current/future state; it did not constrain evidence to already-occurred dated developments |
| `coverage-task-df7023e60f3ce8c39fe349e1915fb6170410136710234ef47913bedc5bd40a17` / `coverage-question-20a6e9d700f3224df0c14024d1f3fa90ae108dcff3d02957beeeb6a99eea1509` | Societal/cultural gap | All phases; Societal and Cultural Impact | `SCHOLARLY_SECONDARY` | “What authoritative dated evidence establishes the locked dimension ... across the scoped chronology ...?” | Broad impact/context obligation; chronology-aware but not occurrence-specific |
| `coverage-task-7e316a2e203328333d04373a83845f92e98d8b2f5092494bd9fc92b2b7625895` / `coverage-question-6808c09603841d9c78f07625e56768c894f2163b7f042d7d5959df10907154e9` | Economic gap | All phases; Economic Impact | `SCHOLARLY_SECONDARY` | “What authoritative dated evidence establishes the locked dimension ... across the scoped chronology ...?” | Broad economic effects/history obligation; likely to return impact summaries and statistics |

The task design is a secondary contributor: it did ask for “dated chronology,” so it was not fundamentally mistargeted, but an obligation such as “identify discrete dated developments that materially changed the Web within the locked phase” would more directly express the coverage predicate.

## All 25 provider-reported queries

Classification describes the wording, not the quality of any returned page.

### Web 2.0 — query `coverage-query-c058415c86452ef9e3e7cc7a38e0f838e96d650f0f46cbcb97c3c7bdd9b98653`

1. `history of Web 2.0 2000-2010 official chronology` — GENERAL HISTORY, DATE-SEEKING, AUTHORITY-TARGETED.
2. `social media development history 2000-2010 institutional sources` — GENERAL HISTORY, DATE-SEEKING, AUTHORITY-TARGETED.
3. `Web 2.0 timeline academic sources 2000-2010` — DATE-SEEKING, AUTHORITY-TARGETED.
4. `early social networking sites history official records` — GENERAL HISTORY, AUTHORITY-TARGETED.
5. `origins of Web 2.0 concept dated sources` — DATE-SEEKING, CONTEXT, AUTHORITY-TARGETED.

### Mobile Web — query `coverage-query-99c9f6c65d16694e00edf67cc95d10ec6d5a4fe93fe63776771e15e167db99e6`

1. `history of mobile web 2010-2020 W3C` — GENERAL HISTORY, DATE-SEEKING, AUTHORITY-TARGETED.
2. `ITU mobile internet development 2010-2020` — GENERAL HISTORY, DATE-SEEKING, AUTHORITY-TARGETED.
3. `IETF mobile web standards history 2010-2020` — GENERAL HISTORY, DATE-SEEKING, AUTHORITY-TARGETED.
4. `GSMA mobile technology evolution 2010-2020` — GENERAL HISTORY, DATE-SEEKING, AUTHORITY-TARGETED.
5. `IEEE mobile web history 2010-2020` — GENERAL HISTORY, DATE-SEEKING, AUTHORITY-TARGETED.
6. `Internet Society mobile access history 2010-2020` — GENERAL HISTORY, DATE-SEEKING, AUTHORITY-TARGETED.

### Current phase — query `coverage-query-b55c83865d4ff1232f45e24c381ce386ec8175c372ea3d39a7ac704602a11429`

1. `World Wide Web history 2020-present authoritative chronology` — GENERAL HISTORY, DATE-SEEKING, AUTHORITY-TARGETED.
2. `W3C World Wide Web trends 2020-present` — STATE/TREND, AUTHORITY-TARGETED.
3. `Internet Society future of web 2020-present` — STATE/TREND, CONTEXT, AUTHORITY-TARGETED.
4. `CERN World Wide Web development timeline 2020-present` — DATE-SEEKING, AUTHORITY-TARGETED.
5. `academic research World Wide Web evolution 2020-present` — GENERAL HISTORY, STATE/TREND, AUTHORITY-TARGETED.

### Societal/cultural dimension — query `coverage-query-7a22a9c19c27a0967ac6b25ef6e28ffe4f63a0e8a4bdfa72a0407cd4b60c172d`

1. `history of World Wide Web societal cultural impact scholarly sources chronology` — GENERAL HISTORY, CONTEXT, AUTHORITY-TARGETED.
2. `academic sources World Wide Web development timeline societal impact` — DATE-SEEKING, CONTEXT, AUTHORITY-TARGETED.
3. `scholarly articles on the historical development and cultural impact of the internet` — GENERAL HISTORY, CONTEXT, AUTHORITY-TARGETED.
4. `books on the history of the World Wide Web and its social implications` — GENERAL HISTORY, CONTEXT, AUTHORITY-TARGETED.
5. `academic research on the evolution of the web and society` — GENERAL HISTORY, CONTEXT, STATE/TREND, AUTHORITY-TARGETED.

### Economic dimension — query `coverage-query-23b1e2d93345a1443843ad87ba073081fdb36bc2634e321e2b165277a766ad88`

1. `history of World Wide Web economic impact scholarly sources chronology` — GENERAL HISTORY, CONTEXT, AUTHORITY-TARGETED.
2. `economic history of the internet academic papers timeline` — DATE-SEEKING, GENERAL HISTORY, AUTHORITY-TARGETED.
3. `development of the World Wide Web economic effects historical analysis` — GENERAL HISTORY, CONTEXT, AUTHORITY-TARGETED.
4. `scholarly review economic impact of WWW evolution` — CONTEXT, STATE/TREND, AUTHORITY-TARGETED.

The plan did search for later-period dated history: every phase query included its locked years and most used “history,” “timeline,” or “chronology.” QUERY is therefore not the primary failure stage. Still, none explicitly asked for launches, releases, decisions, standards adoptions, or other discrete occurrences. “Trends,” “future,” “impact,” “evolution,” and “implications” predictably biased some searches toward state/context knowledge.

## Discovered and retrieved sources

Persisted discovery chunks also exposed candidate domains not admitted, including ITU, GSMA, Internet Society, W3C, Europa, NIH, university sites, EBSCO, Pew, Brookings, the Royal Society, and Taylor & Francis. Discovery alone does not prove that a particular page was authoritative or event-rich, but it proves that source admission had alternatives to evaluate. The scoring implementation did not evaluate snippet/page event utility: verified publisher `+100`, role up to `+35`, intended class up to `+20`, primary tendency up to `+15`, Wikipedia `-80`, then discovery order; it admitted at most two diverse domains per question.

| Source ID / snapshot | URL; publisher | Class / role | Gap/question; approximate relevant period | Cache/retrieval; segments | Why admitted; chronology suitability |
|---|---|---|---|---|---|
| `source-0a8cd50c84d029571565807476fc3721b5a106b97593d937fed26cee4f666c39` / `snapshot-2c88e7f586d7358081cfa46f58d29c244f02a6b694ea79f5dd9279f3fcb97e0a` | `home.cern/.../short-history-web/`; CERN | `PRIMARY_INSTITUTIONAL` / `PRIMARY` | Societal; 1989–1995 | `CACHE_HIT`; 23 | Verified primary publisher dominated score. CHRONOLOGY-RICH overall, but LOW-UTILITY-FOR-GAP because it is early Web history, not later societal chronology |
| `source-1baa3ccc329c3c247621f0011e1b46e1769f1f2fff8b636909be6249e009110b` / `snapshot-e23e2ff0e29dd0759b95f2fcab34a413e5a5e9675a0163680410e89804352452` | `en.wikipedia.org/wiki/Mobile_web`; Wikimedia | `WIKIPEDIA` / `SECONDARY` | Mobile; mixed 1996–2020 | `CACHE_NOT_APPLICABLE`; 200 | Remained competitive despite `-80` because alternatives lacked verified registry scores. EVENT-RICH/MIXED, but categorically unusable for accepted authority |
| `source-551f7d268c548217090fd60800759619974002c9cd2cd1e9917d3ccb1c0a4dd9` / `snapshot-63c38c24f3edd2057b89dfae816010f8296974f026a56d9503719f26b053febb` | `en.wikipedia.org/wiki/History_of_the_World_Wide_Web`; Wikimedia | `WIKIPEDIA` / `SECONDARY` | Societal and Economic; mostly 1980–1994 in selected packet | `REVALIDATED`; 200 | Broad lexical/entity overlap. CHRONOLOGY-RICH, but prohibited and packet-misaligned with both impact gaps |
| `source-6419d3e53a40d46ba2d871dd1707aa988b696b6ce674ef0e72b2a4fad56eb298` / `snapshot-e8055e3b7a6e249894c0e4048de72098f9b03f0ad0760064199f9d3335972e7a` | `w3.org/Mobile/`; W3C | `PRIMARY_INSTITUTIONAL` / `PRIMARY` | Mobile; initiative roughly 2006–2014, otherwise current/general | `CACHE_NOT_APPLICABLE`; 18 | Verified primary publisher and exact mobile terms. STATE/CONTEXT-HEAVY; one useful boundary date but few discrete actions |
| `source-94a013cd33d9f513ca4c56043ce241bd75ba07b25d3d45f5200852e48e543be8` / `snapshot-d0b9cbab8948ba5737fb0e23450728f51d67936b015ce627999c3d25fe306bcb` | `ebsco.com/research-starters/...`; EBSCO | `OTHER` / `MIXED` | Economic; mostly 1990s/general | `REVALIDATED`; 101 | Authority-targeted role lifted an otherwise unclassified candidate. MIXED, but weak authority and LOW-UTILITY-FOR-GAP |
| `source-678353680159dbfe7f1459421d4230c119e3a78f2d02ce2b8424446193867ad4` / `snapshot-e07d0f1156108af5c890f81f171031ff55944b854b447d6499a7a6ec4cc4ffa9` | `en.wikipedia.org/wiki/Web_2.0`; Wikimedia | `WIKIPEDIA` / `SECONDARY` | Web 2.0; 1999–2010 | `REVALIDATED`; 200 | Exact phase terms and discovery position overcame prohibition penalty. EVENT-RICH, but unusable for accepted authority |
| `source-8bd44e3e001ff5f7bfa551b2e5a625dc172247a701c93a850c45b5a5d7be6b33` / `snapshot-2609c10eb96398a2a2f99b086360dd1acef93357398bb6bb63f3abcbcc145b49` | `w3.org/`; W3C | `PRIMARY_INSTITUTIONAL` / `PRIMARY` | Current; present-day homepage and future TPAC 2026 | `CACHE_NOT_APPLICABLE`; 22 | Verified primary publisher dominated despite generic page. STATE/CONTEXT-HEAVY and future-event-oriented |
| `source-b0b968f003a8e56c77df5829530a43e5beb201036d9c8813f566ca04dcde7bb6` / `snapshot-0e60dd8f01f457bede940743ccc73e269f2e383772e2eb9f6388c2d580f13c38` | TU Dublin social-evolution PDF | `OTHER` / `MIXED` | Societal; unknown because body unavailable | `CACHE_NOT_APPLICABLE`, `UNAVAILABLE`, `ACCESS_DENIED`; 0 | Scholarly-looking discovered target, but unknown publisher classification. LOW-UTILITY-FOR-GAP because no evidence could be extracted |
| `source-7888c8c91c9b5937dd078ecd92b66437be9186ae101127fc4d2252605abb1e87` / `snapshot-277311bdb20b285483b3806f9fb3ee41ee07249da169a55677a527a692528b73` | Medium article about Web 2.0 | `OTHER` / `MIXED` | Web 2.0; general | `CACHE_NOT_APPLICABLE`; 9 | Second-domain diversity and phase terms. LOW-UTILITY-FOR-GAP; selected packet yielded zero claims |

The evidence supports SOURCE as the primary failure. “One source per question” was not the mechanism—the code admitted up to two diverse sources per question—but the two-source ceiling plus publisher-biased ranking spent slots on categorical-prohibition, generic, unavailable, or weak-authority pages.

## Evidence packets

| Question/source packet | Selected / available segments; characters; score | Forensic content assessment |
|---|---|---|
| Current / W3C homepage | 11/22; 1,902; reconstructed from frozen selector | Dates, actor, location, and a future TPAC occurrence; otherwise current W3C mission/state. It did not contain a completed 2020–present development suitable for historical chronology |
| Societal / CERN short history | 12/23; 5,972 | Named actors and dates, but nearly all 1989–1995 origin/growth history. Strong chronology, wrong period/dimension utility |
| Societal / Wikipedia Web history | 12/200; 7,256; score 220 | Same packet as economic extraction; dominated by central-entity names and early dates rather than societal-impact passages |
| Economic / Wikipedia Web history | 12/200; 7,256; score 220 | Same early-history packet. Question-specific economic terms failed to differentiate it |
| Economic / EBSCO | 12/101; 4,228 | Some 1990s site openings/traffic facts, broad history, and bibliography material; weak economic-history utility |
| Web 2.0 / Wikipedia | 12/200; 8,740 | Event-rich: dated DiNucci/conference/Ajax/TIME/HTML5/API material. Signal survived packet/extraction but was correctly rejected at authority |
| Mobile / Wikipedia | 12/200; 4,278 | Mixed event/statistical signal: earlier commercial dates and 2010+ forecasts, adoption, traffic, PWA transition. Categorical authority prohibition |
| Mobile / W3C Mobile | 12/18; 1,296 | Actor, initiative boundary (through 2014), standards/features/state; few event verbs and no action/date pair for the same cluster |

No packet was generated for the unavailable TU Dublin source or the low-scoring/empty Medium evidence. The selector awards 3 points per overlapping question term, central-entity phrase points, and only 4 points for any date. Consequently, broad early passages containing “World Wide Web,” CERN, HTML, or other central entities outranked dimension-specific event passages. This is a secondary PACKET defect. The strongest demonstrated “useful source but bad packet” case is the same Wikipedia Web-history packet being selected for both societal and economic questions; because that source was prohibited anyway, correcting packet selection alone would still not have yielded supported chronology.

## Claim evidence reference legend

The all-claims table uses exact snapshot aliases below and exact evidence-segment IDs in the `Evidence` column.

- `S-CERN` = `snapshot-2c88e7f586d7358081cfa46f58d29c244f02a6b694ea79f5dd9279f3fcb97e0a`
- `S-MOBILE-WIKI` = `snapshot-e23e2ff0e29dd0759b95f2fcab34a413e5a5e9675a0163680410e89804352452`
- `S-HISTORY-WIKI` = `snapshot-63c38c24f3edd2057b89dfae816010f8296974f026a56d9503719f26b053febb`
- `S-W3-MOBILE` = `snapshot-e8055e3b7a6e249894c0e4048de72098f9b03f0ad0760064199f9d3335972e7a`
- `S-EBSCO` = `snapshot-d0b9cbab8948ba5737fb0e23450728f51d67936b015ce627999c3d25fe306bcb`
- `S-WEB2-WIKI` = `snapshot-e07d0f1156108af5c890f81f171031ff55944b854b447d6499a7a6ec4cc4ffa9`
- `S-W3-HOME` = `snapshot-2609c10eb96398a2a2f99b086360dd1acef93357398bb6bb63f3abcbcc145b49`

Phase abbreviations: `Early` = 1989–1993, `Growth` = 1993–2000, `Web2` = 2000–2010, `Mobile` = 2010–2020, `Current` = 2020–Present, and `Cross` = dimension question spanning all phases. Semantic nature is forensic classification; the persisted model semantic class exists only on event candidates, not atomic claims.

## All 37 new claims

| # | Claim version / assertion | Type; semantic nature | Temporal; phase | Evidence | Authority verdict; event link / reason |
|---:|---|---|---|---|---|
| 1 | `claim-version-008a0cec419c11982a77f8ca878c193c2926c5ce5f54a0f7449ab79b9aa6fa14` — Stories about the Web hit the media. | `OCCURRENCE`; DISCRETE_EVENT_CLAIM | 1994, YEAR; Growth (asked Cross/Societal) | S-CERN; `segment-29d9238af56f185bd548bc214c74bc4830b081b1c4f6cee39959b97f51d0f342` | `SUPPORTED`; cluster `web-media-1994`; no candidate: no resolved central entity in assertion |
| 2 | `claim-version-062f577660294ea92ec578a6311d5e80924d757fc8078b1f9cf38ae594c14c05` — There were 2.32 billion smartphone owners. | `OCCURRENCE`; STATE | 2017, YEAR; Mobile | S-MOBILE-WIKI; `segment-0e1678aceb220e8b3596592b5b0a007593234c35c82f35b421a66116d1024bf5` | `INSUFFICIENT`; `smartphone-owners-2017`; `MISSING_EVIDENCE`, `WIKIPEDIA_EXCLUDED` |
| 3 | `claim-version-0cef3d16dae01ca3b96ae5c8ea87720876b5f85e65c3ba8bd2623a2b7c93001e` — CERN's announcement made independent development/extensions possible without licensing restrictions. | `CONSEQUENCE`; LEGACY_IMPACT | none; Early/Cross-Economic | S-HISTORY-WIKI; `segment-1a7703373f7c2d76b459821f84e07a1aa80fe144c9ef4e96c127e0c081e750a3` | `INSUFFICIENT`; `cern-www-free-consequence`; Wikipedia excluded |
| 4 | `claim-version-0f21456803640096ce404686521548f57ce3062de0633d2d1f97b35ce370d562` — The Mobile Web Initiative ran until 2014. | `DATE`; STATE_CHANGE_CLAIM | 2014, YEAR (open earliest/latest); Mobile | S-W3-MOBILE; `segment-92b4102bf2c70bf00eb862704178a5dcca1103d31a5936e378bba5b54d179a07` | `SUPPORTED`; `mwi-end-2014`; no candidate: date-only cluster, no paired occurrence/action |
| 5 | `claim-version-1580e6156db0cd56e5d2a6c142ee62e89597b1f714873c437ed62832c5403ad8` — First International WWW conference was hailed as “Woodstock of the Web”. | `OCCURRENCE`; CONTEXT | none; Growth/Cross-Societal | S-CERN; `segment-a4566d76ce77e4d85c743c63f5eab59ef9c0df75942f46214f6e4a9efe9ade79` | `SUPPORTED`; `first-www-conf-woodstock`; no temporal anchor |
| 6 | `claim-version-1cfe4c30388c5bba5b6e4e9b3fc23a7fd926905a0d1299e88ba8277bce70dd18` — Mobile Web best-practice documents offer developer guidance. | `OCCURRENCE`; GENERAL_FACT | none; Mobile | S-W3-MOBILE; `segment-fcdd3719f7e028ed3164b6c90a2d5957a4aebf9e2695c851fff924c12e021922` | `SUPPORTED`; `mobile-web-best-practices`; no temporal anchor/action occurrence |
| 7 | `claim-version-2900bc817bdefc1fb71a172e7d80202eac5195848e6e2c23de6883bc3ffeedfe` — Mobile standards/guidelines work is integrated into W3C’s roadmap. | `OCCURRENCE`; STATE | none; Mobile | S-W3-MOBILE; `segment-92b4102bf2c70bf00eb862704178a5dcca1103d31a5936e378bba5b54d179a07` | `SUPPORTED`; `w3c-mobile-integration`; no temporal anchor; exact W3C entity link absent |
| 8 | `claim-version-33a21bd72cb7fe558c6be3ebf54185b12730f63062bb39cf4f88ebfe0ab7989b` — More than one million visited the IRS site in its first week. | `OCCURRENCE`; STATE | early 1996, YEAR; Growth/Cross-Economic | S-EBSCO; `segment-23ec31b86e8df70ae69b8daf0f80b7e8f46c5ff5d549633cc3bed8155d10f4db`, `segment-c622f016b686c23b31142ba2c43db81cfe1e8c8bf89ca38430535a10b979d7d9` | `INSUFFICIENT`; `irs-web-visits-week-1996`; weak authority; conflicts with #22 |
| 9 | `claim-version-3d7b52c1a5f163ae09414d942c8a6e3e34359282a8dc1acb21b00d8b6c71d10f` — There were 1.57 billion smartphone owners. | `OCCURRENCE`; STATE | 2014, YEAR; Mobile | S-MOBILE-WIKI; `segment-0e1678aceb220e8b3596592b5b0a007593234c35c82f35b421a66116d1024bf5` | `INSUFFICIENT`; `smartphone-owners-2014`; Wikipedia excluded |
| 10 | `claim-version-3dfcca88fa6fc92f95a505b1c4f2387c665182dc615513cc468537d57823d062` — The Web’s platform role on mobile devices is increasingly important. | `OCCURRENCE`; STATE/TREND | none; Mobile | S-W3-MOBILE; `segment-6b6979f4e2c5d41577f55c9e211c713f163848cc8b73044b17ecec11cb4fbeb5` | `SUPPORTED`; `web-platform-importance`; no discrete transition or date |
| 11 | `claim-version-4e336973f5c90db5cd4b06887d15623a4c639252d1722abf6239cbaf823bcb7b` — TIME named “You” Person of the Year. | `INSTITUTIONAL_ACTION`; DISCRETE_EVENT_CLAIM | 2006, YEAR; Web2 | S-WEB2-WIKI; `segment-9b204b3c2ea614ddca0c4ef726d0119efda8a2ac8ca0c6a340fe8168e21a37e8` | `INSUFFICIENT`; `time-person-2006`; Wikipedia excluded |
| 12 | `claim-version-5fe36cb0cb0782ed1c17baa5b92b6b4373bcadbe1a7815751e186182c2641ecf` — Dynatext was considered too expensive and improperly licensed for the HEP community. | `INSTITUTIONAL_ACTION`; CONTEXT | none; Early/Cross-Economic | S-HISTORY-WIKI; `segment-269232a4d94f712e5d74c84cfc51c78dd83dee69e4267fe1a07902f1e1b99acf` | `INSUFFICIENT`; `dynatext-licensing-cost`; Wikipedia excluded |
| 13 | `claim-version-60910b6ac9e3b96a54931104d9878a476fbcb894782551e697d2df911a6f43c6` — More than one million visited the Vatican site in its first two weeks. | `OCCURRENCE`; STATE | late 1995, YEAR; Growth/Cross-Economic | S-EBSCO; same two segments as #8 | `INSUFFICIENT`; `vatican-web-visits-1995`; weak authority |
| 14 | `claim-version-61543a36196a9414bbdf65a1740752a19a046fea2c73be7b65f90c92173504ac` — Mosaic had an immediate impact on WWW spread. | `OCCURRENCE`; LEGACY_IMPACT | none; Growth/Cross-Societal | S-CERN; `segment-a4566d76ce77e4d85c743c63f5eab59ef9c0df75942f46214f6e4a9efe9ade79` | `SUPPORTED`; `mosaic-impact`; no temporal anchor and interpretive impact, not event |
| 15 | `claim-version-662f5a34efe8c05804daee41e0bc733f31cdb9d9369c165b607dac34953fbea9` — ITU forecast mobile access would exceed desktop access within five years. | `OCCURRENCE`; DISCRETE_EVENT_CLAIM | early 2010, YEAR; Mobile | S-MOBILE-WIKI; `segment-018ec5019d40afe1f1baefd35fdf56770630aa34de594f8a3534b5092f0f55e3` | `INSUFFICIENT`; `itu-report-2010`; Wikipedia excluded |
| 16 | `claim-version-69c5a0213806d795da47244055882c6e0a86f99c7d3c82cea35ece08d86aa0f6` — Jesse James Garrett coined “Ajax”. | `OCCURRENCE`; DISCRETE_EVENT_CLAIM | 2005, YEAR; Web2 | S-WEB2-WIKI; `segment-83d2c2714e560086cc20a0cf19a8898912b10e94645979990ccf14595457018d` | `INSUFFICIENT`; `ajax-coined-2005`; Wikipedia excluded |
| 17 | `claim-version-69c68131153a32462c57b3d8a46679fab47d52db363c63303bec65c171f63b32` — W3C’s mission includes Web availability on many device kinds. | `OCCURRENCE`; STATE | none; Mobile | S-W3-MOBILE; `segment-6b6979f4e2c5d41577f55c9e211c713f163848cc8b73044b17ecec11cb4fbeb5` | `SUPPORTED`; `w3c-web-availability`; mission statement, no date/action |
| 18 | `claim-version-6ef4f17b16b80318b2a44aeb0f57ea66e35f4d6026b1cc70b4baceecae74b72d` — TPAC 2026 is in Dublin, Ireland. | `LOCATION`; CONTEXT | none; Current | S-W3-HOME; `segment-fa2d675c65540ba308acd426c7b7c1c4e0aa32d873da1beb6771ee7d4c225436` | `SUPPORTED`; `tpac-2026-gathering`; future cluster and no resolved central entity |
| 19 | `claim-version-70f859dad68863775204b071a9eb00f5581f6dcc68957dd339676dede19236a4` — Mobile Web transitioned to PWAs. | `OCCURRENCE`; STATE_CHANGE_CLAIM | since 2017, YEAR; Mobile | S-MOBILE-WIKI; `segment-018ec5019d40afe1f1baefd35fdf56770630aa34de594f8a3534b5092f0f55e3` | `INSUFFICIENT`; `mobile-web-pwa-transition`; Wikipedia excluded |
| 20 | `claim-version-841e47fe4e87836d73a84d0668289fed7b7ab014c517ec0ba67aab85799efbed` — Mosaic is often credited with sparking the 1990s Internet boom. | `ATTRIBUTION`; LEGACY_IMPACT | none; Growth/Cross-Economic | S-HISTORY-WIKI; `segment-66dfcc759d6db93ec905a1f30873c5329d5bf268db657b72b052e3c1df2cdfd4` | `INSUFFICIENT`; `mosaic-internet-boom`; Wikipedia excluded |
| 21 | `claim-version-87c81cf5cc02089b2b38e782f750889928b20c5a0a01e04170aceca0872a0472` — 1994 was the “Year of the Web”. | `IDENTITY`; CONTEXT | 1994, YEAR; Growth/Cross-Societal | S-CERN; `segment-a4566d76ce77e4d85c743c63f5eab59ef9c0df75942f46214f6e4a9efe9ade79` | `SUPPORTED`; `year-of-web`; label/identity, not occurrence/action |
| 22 | `claim-version-8bc0d007ef6946b54779649b1cf3941e0129b69a2a8732728162cff929c1520e` — 220,000 visited the IRS site in its first 24 hours. | `OCCURRENCE`; STATE | early 1996, YEAR; Growth/Cross-Economic | S-EBSCO; same two segments as #8 | `INSUFFICIENT`; `irs-web-visits-1996`; weak authority; nonblocking conflict with #8 |
| 23 | `claim-version-8e650638dfd6c540916d5989c850708154f5302c43322bc32decfb046ad3f243` — Browser source-code release for public use occurred in 1993. | `DATE`; DISCRETE_EVENT_CLAIM | 1993, YEAR; Early/Cross-Economic | S-HISTORY-WIKI; `segment-66dfcc759d6db93ec905a1f30873c5329d5bf268db657b72b052e3c1df2cdfd4` | `INSUFFICIENT`; `browser-source-release-1993`; Wikipedia excluded |
| 24 | `claim-version-9959a06c2aed6bb12591d0548678049d45200b450a07b2daec311e40b12041ca` — IRS opened its Web site. | `OCCURRENCE`; DISCRETE_EVENT_CLAIM | early 1996, YEAR; Growth/Cross-Economic | S-EBSCO; same two segments as #8 | `INSUFFICIENT`; `irs-web-1996`; weak authority |
| 25 | `claim-version-9992027525002dd08741065527ce37bc563c255caa4e687549d99ba946d36728` — Mobile devices contributed 63.3% of global Web traffic. | `OCCURRENCE`; STATE | April 2015, MONTH; Mobile | S-MOBILE-WIKI; `segment-018ec5019d40afe1f1baefd35fdf56770630aa34de594f8a3534b5092f0f55e3` | `INSUFFICIENT`; `mobile-traffic-2015`; Wikipedia excluded |
| 26 | `claim-version-b6e5810a8c16d6be397202fe6540ec157b0050e595d4b5cf72ee889740b5dbbf` — Tim Berners-Lee introduced the WWW. | `OCCURRENCE`; DISCRETE_EVENT_CLAIM | 1990, YEAR; Early/Cross-Economic | S-EBSCO; `segment-3929c29d9d28874a0adab1b5bd36b68cac88119d15b65f97deba729dd4a51477` | `INSUFFICIENT`; `web-intro-1990`; weak authority |
| 27 | `claim-version-ba5de1195f8d6fb9ae85ebcc93854a7efeda5d45cc5ba74daabb2ab8c998fab3` — Mobile Web applications can use HTML5, CSS3, JavaScript and device APIs. | `OCCURRENCE`; GENERAL_FACT | none; Mobile | S-W3-MOBILE; `segment-c72be647f38b06f6504639836815e4abeb3402c62462bf2e1b8e7b8e285a9b3b` | `SUPPORTED`; `mobile-web-app-progress`; capability list, no date/action |
| 28 | `claim-version-bbb6e99045e60d630307a196a47d8f574e7d4e2974ad940c9a71a511eadec546` — CERN announced the Web would be free and released code publicly. | `INSTITUTIONAL_ACTION`; DISCRETE_EVENT_CLAIM | 30 Apr 1993, DAY; Early/Cross-Economic | S-HISTORY-WIKI; `segment-1a7703373f7c2d76b459821f84e07a1aa80fe144c9ef4e96c127e0c081e750a3` | `INSUFFICIENT`; `cern-www-free-1993`; Wikipedia excluded |
| 29 | `claim-version-c45ec2f8d8a2d6ceb470b059a798fba69a7466f60e75dc0ced22848d874daac0` — HTML5 was introduced. | `OCCURRENCE`; DISCRETE_EVENT_CLAIM | 2010, YEAR; Web2 boundary | S-WEB2-WIKI; `segment-a3a12121aae2ef825a89acc1c9034538f4f7c9a77b66b93b668c86c52779974b` | `INSUFFICIENT`; `html5-intro-2010`; Wikipedia excluded |
| 30 | `claim-version-cee3dbd3f46bc78079ca19bed156c9100d1e3a6f42dfe20db7f29d9a8d3201bb` — Vatican opened a Web site. | `OCCURRENCE`; DISCRETE_EVENT_CLAIM | late 1995, YEAR; Growth/Cross-Economic | S-EBSCO; same two segments as #8 | `INSUFFICIENT`; `vatican-web-1995`; weak authority |
| 31 | `claim-version-e2ba18bde9a3d1b8105db16bffe0d65ff0608d223c438924e81f1b258b255ef4` — CERN enabled widespread use by releasing the invention publicly. | `INSTITUTIONAL_ACTION`; LEGACY_IMPACT | none; Early/Cross-Economic | S-HISTORY-WIKI; `segment-1a7703373f7c2d76b459821f84e07a1aa80fe144c9ef4e96c127e0c081e750a3` | `INSUFFICIENT`; `cern-www-public-use`; Wikipedia excluded |
| 32 | `claim-version-e580782654050772a0e5f3581547a314b9b6d3c84fdcba36689d7626d2a0db99` — TPAC 2026 is on 26–30 October. | `DATE`; CONTEXT | 26 Oct 2026, DAY label range; Current | S-W3-HOME; `segment-fa2d675c65540ba308acd426c7b7c1c4e0aa32d873da1beb6771ee7d4c225436` | `SUPPORTED`; `tpac-2026-gathering`; future relative to run date, no resolved central entity |
| 33 | `claim-version-ed9e148f4c430a2c25db2aa571b581b4486030f47f2518dd92711fc959d2208e` — More than five billion mobile-phone users existed worldwide. | `OCCURRENCE`; STATE | 2020, YEAR; Mobile/Current boundary | S-MOBILE-WIKI; `segment-0e1678aceb220e8b3596592b5b0a007593234c35c82f35b421a66116d1024bf5` | `INSUFFICIENT`; `mobile-users-2020`; Wikipedia excluded |
| 34 | `claim-version-f414f30d5d36e0a7e60d97772b4ee6d2107024a8f7bdb13d8a2616494ec24492` — WWW revolutionised communications worldwide. | `OCCURRENCE`; LEGACY_IMPACT | none; Cross/Societal | S-CERN; `segment-2548de1d18b0a125ad1f4ff8ae8cfd949c2732d4721a7d2540b55ca01764a5cb` | `SUPPORTED`; `web-revolution`; broad impact, no bounded occurrence/date |
| 35 | `claim-version-f47d5bbbe0a9e985230dccadad6ac49cbb582cf4bce5e03a19bb144bcf469709` — Amazon opened its API to outside developers. | `INSTITUTIONAL_ACTION`; DISCRETE_EVENT_CLAIM | 2002, YEAR; Web2 | S-WEB2-WIKI; `segment-293cb50da9e2011480f90fe716150bbc5e3669f9fb526b7ab58d878f25487444` | `INSUFFICIENT`; `amazon-api-2002`; Wikipedia excluded |
| 36 | `claim-version-f48e8a0a3cfad89bd5dbc045e96ccf6cf2dd9878f43c5c511a540c118832f416` — WWW accounted for 1% of Internet traffic. | `OCCURRENCE`; STATE/LEGACY_IMPACT | late 1993, YEAR; Growth/Cross-Societal | S-CERN; `segment-a4566d76ce77e4d85c743c63f5eab59ef9c0df75942f46214f6e4a9efe9ade79` | `SUPPORTED`; `www-traffic-1993`; candidate `8da339bb-7415-530c-bce9-9ae620f0a114` → `STATE_LEGACY` / `INELIGIBLE` |
| 37 | `claim-version-fe81a6184fdb7a52637bfeb613c86bf9134eadd39799cce617174f6f413bdf2b` — TPAC 2026 gathers the W3C community. | `OCCURRENCE`; DISCRETE_EVENT_CLAIM (future) | none on claim; Current | S-W3-HOME; `segment-fa2d675c65540ba308acd426c7b7c1c4e0aa32d873da1beb6771ee7d4c225436` | `SUPPORTED`; `tpac-2026-gathering`; future, and exact W3C central entity link absent |

## The 15 supported claims

| Claim # | Classification | Could legitimately contribute to chronology? | Downstream outcome |
|---:|---|---|---|
| 1 | DISCRETE_EVENT_CLAIM | Yes, but only to 1994 growth history, not a material later gap | No resolved central entity in the cluster; no candidate |
| 4 | STATE_CHANGE_CLAIM | Potentially, if paired with authoritative occurrence/action evidence for the initiative ending | Persisted as DATE only; cluster lacked `OCCURRENCE`/`INSTITUTIONAL_ACTION` companion |
| 5 | CONTEXT | Not as persisted | No temporal anchor; “was hailed as” is reception context |
| 6 | GENERAL_FACT | No | Describes what guidance offers, not issuance/adoption and has no date |
| 7 | STATE | No | Present integration state with no dated transition; W3C full canonical-name match also absent |
| 10 | STATE | No | “Increasingly important” is a trend, not a bounded occurrence |
| 14 | LEGACY_IMPACT | No | Broad causal/impact statement with no date |
| 17 | STATE | No | Mission statement with no dated action |
| 18 | CONTEXT | Only as location support for a valid event | TPAC was future; location alone cannot form an event |
| 21 | CONTEXT | No | A historical label/identity, not an action |
| 27 | GENERAL_FACT | No | Capability/feature list with no transition date |
| 32 | CONTEXT | Only as temporal support for a valid event | Date was future relative to `ongoingAsOf`; exact entity link absent |
| 34 | LEGACY_IMPACT | No | Unbounded societal impact, not discrete occurrence |
| 36 | LEGACY_IMPACT / STATE | No | Resolver built the sole candidate and correctly classified the measured traffic state `STATE_LEGACY` |
| 37 | DISCRETE_EVENT_CLAIM (future) | Not for completed historical chronology | Future relative to 2026-09-06; exact central entity `World Wide Web Consortium (W3C)` was not resolved from abbreviation-only evidence |

Thus category A—no chronology-eligible supported claim cluster existed—is the core explanation. D (missing action/date pairing) and E (exact entity linking) contributed to the Mobile Initiative and TPAC cases, respectively. There is no persisted evidence that the resolver discarded a valid supported later historical event.

## The 22 insufficient claims

All 22 have `MISSING_EVIDENCE` plus exactly one source-authority reason:

- 16 `WIKIPEDIA_EXCLUDED`: claims #2, #3, #9, #11, #12, #15, #16, #19, #20, #23, #25, #28, #29, #31, #33, #35.
- 6 `WEAK_AUTHORITY`: claims #8, #13, #22, #24, #26, #30, all from the EBSCO `OTHER` / `MIXED` source with `UNCLASSIFIED` evidence edges.
- Insufficient independence, relevance, interpretive burden, date uncertainty, malformed semantics, and no-exact-segment-support were not recorded verdict causes for this set.
- The only conflict was the nonblocking IRS first-day/first-week traffic pair (#8/#22); it did not cause either insufficiency verdict.

Strong-looking event signal exists among rejected claims: TIME’s 2006 action, Ajax naming in 2005, Amazon API opening in 2002, HTML5 introduction in 2010, CERN’s 1993 public-domain action, IRS/Vatican site openings, and the mobile/PWA transition. Source Authority behavior is not suspicious: Wikipedia is explicitly orientation-only/prohibited, and the EBSCO publisher/evidence was not classified strongly enough. Lowering authority thresholds would convert weak evidence into chronology and is not supported. The upstream error was spending scarce admission/extraction capacity on documents known or likely to fail those rules.

## Event-resolution trace

The resolver groups passing claims by `candidateEventClusterId` and requires all of the following: at least one supported/qualified claim; a resolved central entity whose normalized full canonical name appears in cluster evidence; a temporal anchor; and an `OCCURRENCE` or `INSTITUTIONAL_ACTION` claim. Only CERN and HTML entity versions resolved in this run.

- `www-traffic-1993` was the only cluster satisfying mechanical construction requirements. It used claim #36, late 1993, and a resolved Web-related primary entity key. Candidate `8da339bb-7415-530c-bce9-9ae620f0a114` became `event-version-a8b109c943719ab973677987a3bbe5d41b98eedfe685b4c9b60301dd4d4edd9d`, title `WWW`, action “The WWW accounted for 1% of internet traffic.” Its persisted semantic class is `STATE_LEGACY`; canonicalization is `INELIGIBLE`. This is correct: a traffic share is a measured state, not a discrete occurrence.
- `mwi-end-2014` had a supported date but no same-cluster occurrence/action claim. The W3C Mobile descriptive claims were separate clusters without dates.
- `tpac-2026-gathering` had supported occurrence/date/location pieces, but described an event after the audit date and did not resolve the locked entity’s full canonical name `World Wide Web Consortium (W3C)` from W3C-only mentions.
- `web-media-1994` was a supported dated occurrence, but lacked a resolved central entity in the assertion and addressed early/growth rather than the missing later chronology.
- The remaining supported clusters lacked a temporal anchor, an event action, or both.
- Event-like Web 2.0 and Mobile claims rejected by authority never entered event resolution.

Classification: **A is primary**. **D and E are secondary contributors in isolated clusters**. B and C are not supported as general causes. F applies only to the separate extraction-budget defect, not event eligibility.

## Later-phase and dimension signal loss

| Material area | Sources | Supported signal | Rejected signal | Candidate result | Where signal disappeared |
|---|---|---|---|---|---|
| Web 2.0 (2000–2010) | Wikipedia Web 2.0; Medium | None | TIME 2006, Ajax 2005, Amazon API 2002, HTML5 2010 | 0 event/non-event candidates | SOURCE → AUTHORITY. The only event-rich source was prohibited; Medium yielded no claims |
| Mobile (2010–2020) | W3C Mobile; Wikipedia Mobile | Six W3C claims: initiative end date, guidance, roadmap integration, platform importance, mission, capability list | Six Wikipedia claims: smartphone counts, ITU forecast, PWA transition, mobile traffic, mobile users | 0 candidates | SOURCE/AUTHORITY first; then CLAIM pairing. Supported primary evidence was state-heavy and separated date from action |
| Current (2020–Present) | W3C homepage; unavailable TU Dublin PDF | TPAC future location/date/occurrence | None | 0 candidates | SOURCE: generic current homepage and unavailable second source; EVENT RESOLUTION correctly excluded future/unlinked cluster |
| Societal/Cultural | CERN early history; Wikipedia Web history | Six early/general CERN claims | Six early Wikipedia claims appeared in the economic packet; societal Wikipedia extraction accepted zero | 1 non-event candidate from 1993 traffic | SOURCE/PACKET: authoritative source was early history; generic selector did not target later societal transitions |
| Economic | EBSCO; Wikipedia Web history | None | Six weak EBSCO claims and six prohibited Wikipedia claims | 0 | SOURCE/AUTHORITY/PACKET: broad early history, wrong authority, and poor dimension-specific packet discrimination |

The final audit’s three later phase cells changed from missing to weak because supported non-event knowledge was globally associated, but all still lacked authoritative chronology-eligible events. Economic remained weak with zero supported claims; the critical chronology, Web 2.0, and economic questions remained unanswered; ongoing scope remained stale. Latest chronology year stayed 1994.

## Extraction, research, and resolver design assessment

### Claim extraction

The prompt allowed up to six assertions, instructed splitting occurrence/date from interpretation, and supported `EVENT`, `STATE_LEGACY`, `CONTEXT`, and `FUTURE` semantics, but it was a general knowledge extraction contract rather than a chronology-seeking one. The persisted output shows:

- The model did not categorically ignore obvious event signal: it extracted four event-like Web 2.0 assertions from the event-rich packet and six dated Mobile Wikipedia assertions.
- It did prefer descriptive/contextual assertions when primary packets were descriptive. From W3C Mobile it extracted the initiative end as a standalone DATE while placing related roadmap/standards descriptions in different clusters with no dates. That action/date separation prevented event construction.
- The six-claim per-packet cap may have excluded additional signal in 200-segment pages, but persisted evidence cannot establish which omitted claims would have passed authority; no causal claim is made.
- Packet ordering mattered because only eight packets ran and first-ranked sources were interleaved before second-ranked corroboration. However, the selected source set was already structurally weak.
- Event-rich later passages existed in the selected Wikipedia packets and were extracted, but were correctly unusable. No authoritative later event-rich passage is proven to have been in an admitted packet and then ignored.

Therefore CLAIM is secondary, not primary. A future implementation goal may eventually distinguish chronology-seeking extraction from general knowledge extraction, but that is not the minimum correction supported by this audit.

### Source selection and gap research

The decisive source-admission defect is visible in `sourceCandidateScore` and `admitSourcesByQuestion`: no score represents date-range fit, discrete-event wording, question-term specificity beyond upstream discovery, snippet evidence, retrievability, or downstream authority eligibility. Verified generic CERN/W3C pages receive overwhelming preference; known Wikipedia can still consume a slot; unknown potentially relevant institutional/scholarly candidates start at a large registry disadvantage. Domain diversity was enforced before event utility.

Gap questions themselves are somewhat abstract, especially impact/trend obligations, but the provider queries demonstrably included later periods and chronology/date terms. Better question wording would help; it does not explain why known-prohibited and generic pages were admitted ahead of alternatives. Gap targeting is secondary/minor.

### Event resolution

The resolver is correctly strict for the evidence it received. It did not silently discard an authoritative, dated, historical later-phase event. Exact entity matching and action/date pairing are concrete limitations, but relaxing them without better evidence would risk constructing false chronology. EVENT RESOLUTION is not the primary cause.

## Budget-counter defect

This is a separate **EXECUTION_BUDGET_DEFECT**, not the reason chronology was zero.

- `DEFAULT_COMPLETION_BUDGET.maximumClaimExtractions` and the completion-result schema both set the maximum to 5.
- `run-v2a3-web.ts` creates `completionResearchBudget` without a `maximumClaimExtractions` member; the standard runtime budget schema has no equivalent field.
- `orchestrator.ts` explicitly constructs `claimInputs` by interleaving ranks 0 and 1 across questions and then `.slice(0, 8)`. It does not consult the completion ceiling of 5.
- `metrics.evidencePackets = claimInputs.length`, so the counter unit is submitted source-question evidence packets / extraction calls. It is not claim count, retry count, or repair count. All 8 extraction calls succeeded and used zero semantic repairs.
- `buildKnowledgeCompletionResult` copied `acquisition.metrics.evidencePackets` into `budgetConsumed.claimExtractions`; Zod correctly rejected observed 8 against maximum 5.

The schema is not stale relative to the declared completion policy. The executor violated the intended budget because that limit was not bound into its runtime configuration/control path. Counting semantics are clear enough to expose the violation, so this is not merely telemetry/schema mismatch.

## Root-cause ranking

| Category | Rank | Evidence-based conclusion |
|---|---|---|
| Source selection | PRIMARY | Admission did not score exact gap/date/event utility or downstream eligibility; scarce slots went to Wikipedia, generic primary pages, weak/unavailable sources, and early history |
| Evidence-packet selection | SECONDARY | Central-entity lexical overlap and a small binary date bonus selected the same early broad packet for distinct impact questions |
| Claim extraction | SECONDARY | General extraction produced state/context and failed to pair W3C Mobile action with its date, though it did extract event signal where packets contained it |
| Gap-question targeting | MINOR | “Material developments” and broad impact questions are less explicit than a discrete-occurrence obligation, but they did request authoritative dated evidence |
| Query formulation | MINOR | Queries covered later periods and chronology, but “trends/future/evolution/impact” invited non-event material |
| Source Authority | NOT A CAUSE | It correctly rejected prohibited Wikipedia and weak/unclassified evidence |
| Event resolution | NOT A CAUSE (minor isolated limitations) | No valid supported later historical event cluster reached it; exact W3C linking and date/action pairing affected isolated cases |
| Coverage logic | NOT A CAUSE | It correctly required chronology-eligible events and kept latest event year at 1994 |
| Budget schema/control | OTHER: independent execution defect | It caused terminal result-schema failure, not zero eligible events |

## Minimum correction recommendation

Authorize one narrowly bounded implementation goal at the source-admission boundary: **change coverage-completion source admission to rank exact locked-gap, date-range, and discrete-event relevance plus downstream authoritative-source suitability ahead of generic publisher-registry status/diversity/discovery order, and prevent extraction slots from being spent on sources categorically prohibited by Source Authority.**

This is upstream of packet selection, claim extraction, authority evaluation, and event resolution. Better admitted sources can supply authoritative event-bearing passages to every later stage while preserving the current strict authority and event gates. Changing the extractor or resolver first would only process the same weak/prohibited material more aggressively. The budget-control defect warrants its own later implementation goal and must not be bundled into this correction.

## Certification state

- Web A3 knowledge coverage: **NOT CERTIFIED**.
- V2-B: **NOT CERTIFIED**; B1 was not modified and B2 was not invoked.
- Autonomous discovery: **PAUSED**.
- No implementation is authorized by this report.

## Read-only closure validation

The closure audit re-read production state after the forensic analysis:

- `factoryV2/config` remains `SHADOW` with pipeline/schema/policy/prompt `.10/.3/.9/.8`; publication, Governance submission, and autonomous discovery are all `false`; deterministic configuration hash remains `74f7c68c70a612300a7c855f9fc51b02d7dbbe85b0a5299eedf1bcaaf926c8e2`.
- Cloud Scheduler job `topic-discovery-daily` remains `PAUSED`, schedule `0 3 * * *`, timezone `UTC`.
- Corpus `v2TopicOperations` contains 0 `RUNNING` operations.
- Published Memory remains 4 records, 0 attributed to Factory V2, with deterministic comparison hash `006d346031773dc6f1cba400a62215a3e9874b2567b26dae0acd3f4eef01d21c`.
- Platform read models remain 46 records, 0 attributed to Factory V2, with deterministic comparison hash `172596509263f477c1756d57cd87c8c2e453d6bb3b536f3f45e98002235444f1`.
- Repository validation found only this forensic document changed, no runtime/configuration file changed, no `.DS_Store`, and `git diff --check` passed.
- These were read-only queries. No production document or scheduler state was mutated.
