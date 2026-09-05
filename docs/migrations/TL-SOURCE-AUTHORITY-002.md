# TL-SOURCE-AUTHORITY-002 — Trusted Source Architecture and Claim-Level Authority

Date: 2026-09-05

Corpus: `timelines-clean-2026-09-v1`

Source Authority policy: `source-authority-v2.0.1-certified-2026-09-05`

Pipeline: `serverless-pipeline-v4-source-authority`

Research prompt: `historical-research-v4.1-source-authority`

Governance policy: `routine-governance-v4-source-authority`

## Scope and safety

This change adds Source Authority V2 to the existing serverless generation and institutional publication path. It is not a content reset, UI change, or architecture replacement. Autonomous discovery was paused before implementation. User/Admin intake and all Cloud Tasks queues remained enabled. No active timeline was regenerated, revised, unpublished, or republished for certification. All live fixtures are immutable and explicitly `publicationEligible: false`.

The implementation and audit are confined to the active clean corpus. The production pointer still resolves to `timelines-clean-2026-09-v1` with isolation policy `NO_LEGACY_CONTENT_REUSE`.

## Read-only production source audit

The reproducible audit is `npm run source-authority:audit`. It reads the published candidate, exact grounded snapshot, evidence records, and claim links, then emits every actually used source with domain, persisted publisher and page title, Source Authority V2 classification, primary/secondary role, supported events, claim authority, corroboration, and acquisition mechanism. It performs no writes.

### Current implementation before V2

The active serverless path previously:

1. accepted HTTPS grounding chunks returned by Vertex Google Search Grounding;
2. required at least two durable sources and two attributable grounding-support segments;
3. persisted source records, source snapshots, evidence records, claim links, and structural `PASSED` evidence validations;
4. prompted research to prefer institutions, universities, recognized references, and reputable publishers;
5. allowed routine Governance when source references resolved, at least two sources existed, chronology/duplicate checks passed, and Timeline Quality passed.

It did not classify source type, publisher identity, scholarly or institutional status, domain reputation, primary/secondary role, claim-specific relevance, risk-sensitive corroboration, source independence, or authoritative-source conflict. It neither scored nor rejected a source for historical authority. The only preference was natural-language prompt guidance; every audited production source was discovered through Google Search Grounding rather than selected by an existing authority policy.

The audit also found a legacy retry-lineage weakness in the World Wide Web publication: the successful candidate/evidence resolves uniquely to the 41-source snapshot `9417798d2e8249d70951f893934c4ed83d52c7bc`, while the legacy Published Memory source list came from an arbitrary first snapshot and contains 12 references. V2 now binds candidate, evidence, authority artifact, Governance package, and publication to one exact snapshot. Existing immutable lineage was preserved rather than rewritten.

### The History of the World Wide Web

- Topic: `6bb556f4ab0abcc305af55b7a9e83f51fbb79420`
- Job: `91b1cf4e-1bf5-4396-a5a9-0a83ffee13b3`
- Exact candidate/evidence snapshot: `9417798d2e8249d70951f893934c4ed83d52c7bc`
- Evidence records/claim links: 21/21
- Actually used source entries: 41 across 24 domains
- Diversity: 23 publisher identities, 7 source types, 6 primary references, 25 secondary references, 10 Wikipedia entries, 3 established geographic contexts
- Domains: `britannica.com`, `cern.ch`, `cybercultural.com`, `ebsco.com`, `facebook.com`, `firefox.com`, `goldmansachs.com`, `historyofinformation.com`, `home.cern`, `illinois.edu`, `kennesaw.edu`, `medium.com`, `onlineinvent.com.au`, `pewresearch.org`, `poynter.org`, `smartbear.com`, `sofi.com`, `techtarget.com`, `uoregon.edu`, `visualcapitalist.com`, `w3.org`, `webfoundation.org`, `wikipedia.org`, `youtube.com`
- Strongest source families: CERN, W3C, Britannica, EBSCO edited reference, and university sources
- Weak source types include general-web, social/video, commercial explainer, and unverified specialist pages
- Material authoritative conflicts: none detected
- Retrospective verdict: **FAILED**; 7/18 events pass V2

Passing events:

- First Web Server and Browser Implemented
- Nicola Pellow Develops Line Mode Browser
- WWW Software Released Internally at CERN
- Mosaic 1.0 Released
- “Woodstock of the Web” Conference Held
- World Wide Web Consortium (W3C) Founded
- Dot-Com Bubble Emerges

Events requiring stronger claim-relevant authority or independent corroboration:

- Tim Berners-Lee Proposes Information Management System
- HTML, URI, and HTTP Developed
- World Wide Web Management Proposal Formalized
- WWW Software Announced Globally
- NCSA Releases Mosaic Browser Pre-releases
- World Wide Web Software Made Royalty-Free
- Netscape Navigator 1.0 Released
- Microsoft Releases Internet Explorer
- Term “Web 2.0” Coined
- Dot-Com Bubble Peaks
- Web 2.0 Popularized by O’Reilly Media

### The Fall of the Berlin Wall

- Topic: `378338ba105ec8027857ae7fb72c3dd41baefff2`
- Job: `a901a554-3c5d-495f-86a7-d05be71063d9`
- Exact candidate/evidence snapshot: `98b4b5153a5db0fdc58d6a8c70f9eb8eee6abe32`
- Evidence records/claim links: 20/20
- Candidate snapshot sources: 31; actually used source entries: 24 across 21 domains
- Diversity: 27 publisher identities in the full snapshot, 7 source types, 1 primary reference, 22 secondary references, 2 Wikipedia entries, 3 established geographic contexts
- Domains actually used: `apnews.com`, `apu.edu`, `balticworlds.com`, `cfr.org`, `docsteach.org`, `ebsco.com`, `insightvacations.com`, `iwm.org.uk`, `lumenlearning.com`, `pmfias.com`, `polsci.institute`, `preceden.com`, `rusi.org`, `state.gov`, `stiftung-berliner-mauer.de`, `study.com`, `syr.edu`, `theworld.org`, `tufts.edu`, `wikipedia.org`, `youtube.com`
- Strongest source families: Berlin Wall Foundation, U.S. State Department, U.S. National Archives/DocsTeach, Imperial War Museums, AP, EBSCO edited reference, and universities
- Weak source types include general-web chronologies, commercial travel/education pages, video hosting, and unverified specialist pages
- Material authoritative conflicts: none detected
- Retrospective verdict: **FAILED**; 3/12 events pass V2

Passing events:

- Hungary Opens Border with Austria
- Günter Schabowski’s Press Conference Announcement
- German Reunification

Events requiring stronger claim-relevant authority or independent corroboration:

- Berlin Wall Construction Begins
- Mass Exodus of East Germans Through Hungary
- Peaceful Revolution Protests Escalate
- Erich Honecker Resigns as East German Leader
- Alexanderplatz Demonstration
- Berlin Wall Opens
- Brandenburg Gate Reopens
- German Monetary Union
- Demolition of Berlin Wall Completed

These retrospective failures are recorded honestly. They do not retroactively mutate or unpublish content certified under the earlier policy.

## Source Authority V2 policy

### Separate dimensions

Source quality and claim relevance are evaluated independently. A high-tier source that is unrelated to the named institution or claim is supporting evidence only and cannot satisfy corroboration. Tests specifically prove that NASA/CERN prestige cannot establish a French Revolution claim.

### Taxonomy and tiers

- Tier A primary/institutional: verified official institutions, archives, museums, standards/scientific bodies, official programs, and recognized intergovernmental organizations.
- Tier A scholarly: recognized scholarly publishers and academic sources; the artifact distinguishes a verified scholarly prior from an academic-domain pattern.
- Tier A/B edited reference: Britannica, Oxford Reference, EBSCO edited reference, and equivalent controlled references.
- Tier B journalism: established editorial news organizations such as Reuters, AP, and BBC.
- Tier B/C Wikipedia: orientation and cross-checking, never a sole strong authority for a consequential claim.
- Tier C reputable specialist: topic-dependent expert organizations.
- Tier D general web: low-accountability or general web material; it may support discovery/context but does not establish a material claim.
- Unclassified: authority is not established and the claim threshold fails closed.

The hybrid classifier combines verified publisher priors, institutional/academic domain patterns, publisher-parent identity, claim text relevance, institution affinity, source role, and corroboration. It supports country-code government/academic domains and explicit non-English/non-Western institutions; it is not a simple allowlist. Unknown organizations remain unclassified until deterministic evidence establishes their status.

Each source inventory item records domain, persisted publisher/page title, publisher identity, classification, tier, default evidence role, institutional status, scholarly status, geographic context/basis, independence key/basis, and classification basis.

### Britannica and Wikipedia

Google Search Grounding surfaced Britannica in the World Wide Web audit, including direct claim support. Britannica is treated as a strong professionally edited secondary reference, not as mandatory evidence. Britannica’s published editorial process uses expert writers, professional editors, fact-checkers, copy editors, and supervisory review. Grounding currently often persists only a domain label and redirect URL, so full page title, language, paywall, and retrieval-access status cannot always be established. V2 persists that limitation and does not scrape or bypass access controls.

Wikipedia remains available for chronology discovery, terminology, related entities, and cross-checking. It is classified as orientation, is excluded from independent strong-source counts, and cannot be the sole authority for a consequential event. The targeted repair prompt directs research toward the underlying institutional, scholarly, or edited source.

### Claim risk and evidence thresholds

- Routine fact: at least one strong, direct, claim-authoritative source.
- Major milestone: two independent strong authorities, unless one Tier A primary record is clearly definitive for the exact institutional/factual claim.
- Contested/interpretive claim: multiple independent strong sources; a self-interested primary source is insufficient by itself.
- Exceptional/high-risk claim: multiple independent strong sources; unresolved authoritative disagreement routes to exceptional Governance review.

Primary does not mean automatically sufficient. Institution affinity must match the claim, and a primary source alone cannot establish a broad interpretive conclusion.

### Corroboration, independence, and conflict

Corroboration counts publisher-parent identities rather than URLs. Multiple pages from one institution count as one group. Known publisher aliases collapse common parents. Where grounding exposes only a redirect/domain, syndication, copied reporting, authorship, or a reproduced press release cannot be inferred; the artifact records that limitation.

Conflict detection considers only direct, claim-authoritative evidence. It detects explicit disagreement and comparable year/quantity conflicts. A weak-web disagreement cannot manufacture an authoritative conflict. Material authoritative disagreement yields `exceptional_review`; the routine path never silently chooses one source.

### Deterministic evidence selection and bounded escalation

Generated candidate evidence is deterministically re-ranked by direct relevance, institutional affinity, independent strong groups, authority tier, and stable catalog order. Each event retains at most three evidence segments and three source references.

Normal research is assessed first. If Timeline Quality passes but Source Authority does not, exactly one targeted authority-research pass is allowed. The merged source/evidence catalog uses deterministic non-colliding identifiers. Provider retries remain bounded to three attempts and are now counted as actual provider calls. There is no source-count maximization loop.

## Persisted artifact and institutional gate

Every V2 evaluation persists an immutable `sourceAuthorityArtifacts` record and a Factory artifact reference containing:

- policy version and exact source snapshot;
- source inventory and publisher identities;
- classification, tier, source role, institutional/scholarly/geographic status;
- material claim, risk, exact evidence links, and claim relevance/authority;
- corroboration requirement, independent groups, and definitive-primary result;
- conflict findings, unresolved issues, per-claim verdict, and overall verdict;
- grounded/provider/repair call counts, sources evaluated, and Vertex usage metadata;
- deterministic payload hash and explicit metadata limitations.

Governance packages carry the exact Timeline Quality artifact, Source Authority artifact, candidate object, and source snapshot. Routine Governance requires both current policies to pass with no authority conflict. The institutional transition independently re-verifies package ownership/version/lifecycle, candidate hash, Timeline Quality hash/verdict, Source Authority hash/verdict/claim coverage, exact snapshot, every source reference, every evidence record, its `PASSED` validation, and its claim link. Any missing, stale, mismatched, corrupted, or non-passing link fails closed before Historical Library admission.

The exact Source Authority artifact and snapshot references propagate through Governance decision/audit, Library admission, Published Memory, and the publication audit event. Internal authority artifacts are not exposed by the public API or UI.

## Live non-public certification fixtures

All final fixtures use `source-authority-v2.0.1-certified-2026-09-05` and have `publicationEligible: false`.

| Class | Exact claim | Job | Authority artifact | Sources | Calls / extra / repair | Duration | Result |
|---|---|---|---|---:|---:|---:|---|
| Scientific/technical | NASA launched Apollo 11 on 1969-07-16 | `5b89bd1b-a4cb-4c76-9df2-e77fc7ea96bc` | `2faa9caaebcfcd2f3c04aee6ed0eb38e9a380fbb` | 7 | 1 / 0 / 0 | 15.537s | PASSED, definitive NASA primary |
| Political/historical | German reunification on 1990-10-03 | `2c0a8547-1a8e-4422-a72a-b1521101a734` | `7a3f63882266288ddb18343574ddfb6e130b25a7` | 11 | 1 / 0 / 0 | 19.846s | PASSED, German Foreign Office plus independent GHI/ENRS groups |
| Cultural/social | UNESCO adopted the World Heritage Convention on 1972-11-16 | `bc1e26b6-be2d-4af6-a3ef-344e9414c007` | `6efa52881e9116bd665f8b59a86929c4c58c5c6a` | 7 | 1 / 0 / 0 | 12.099s | PASSED, UN institutional evidence plus EBSCO; Wikipedia orientation only |

Final total: 3 grounded calls, 25 sources evaluated, 0 additional provider calls, 0 repair calls, mean latency 15.827s.

Negative fixtures were retained. They include Wikipedia-plus-weak evidence, duplicated same-parent sources, unrelated prestigious institutions, weak-web evidence, self-interested primary evidence for interpretation, and conflicting strong dates. An exploratory cultural live run also failed when search returned only one strong independent authority; it remained non-public. The subsequent general prompt correction preferred the named institution’s official/original record and the final independent run passed without a repair loop.

## Verification

- Functions Source Authority, Timeline Quality, serverless contracts, and Governance gates: 35/35 passed.
- Application suite: 249/249 passed across 9 suites.
- Editorial certification: 68/68 passed.
- Historical Library certification: 7/7 passed.
- Published Memory certification: 7/7 passed.
- Projection Engine certification: 7/7 passed.
- Search certification: 8/8 passed.
- Public Platform certification: 8/8 passed.
- Root and Functions typecheck: passed.
- Root lint: passed.
- Functions build and Next.js production build: passed.
- Dependency audits: no high or critical findings. Root retains 1 low/8 moderate transitive findings; Functions retains 8 moderate transitive findings. Forced fixes would introduce breaking dependency downgrades.
- Private worker checks: unauthenticated priority, autonomous, and institutional requests return HTTP 403; Cloud Run IAM has no `allUsers` bindings.
- Public API: health reports `serverless-public-api-v2-clean-corpus`; Berlin topic status is `PUBLISHED`; unsigned topic intake is rejected without a write.
- Production site: homepage, both timeline routes, timeline API, and search API return HTTP 200.
- Public content remains two active timelines/two Published Memory records. Web projection hash remains `51d932ec84b1d72a32dae2c30272d120c3e700c6423426905a10996c5611d900`; Berlin remains `5b4c0fac4421dab2eed160dba29058d41c3cfb611237a83677f2283e9f67b54b`.
- Exceptional-review suppression remains present and the autonomous exceptional-review backlog is 0.

## Deployment and operational state

Only affected Functions were deployed; the public API, website, and discovery function were not redeployed.

- Priority generation: `priority-topic-generation-00009-rex`, ACTIVE, 100% traffic.
- Autonomous generation: `autonomous-topic-generation-00009-ruq`, ACTIVE, 100% traffic.
- Institutional transitions: `institutional-transitions-00007-hop`, ACTIVE, 100% traffic.

All use Node.js 22, `timelines-runtime@tiimeliines.iam.gserviceaccount.com`, and `timelines-clean-2026-09-v1`. Priority, autonomous, and institutional Cloud Tasks queues are RUNNING. No error-level logs were emitted by the new revisions during post-deployment verification.

`topic-discovery-daily` was paused during implementation and deployment, then resumed only after all certification checks and this record were complete. It is ENABLED on its unchanged `0 3 * * *` UTC schedule.

## Remaining risks

- Vertex grounding commonly provides a redirect URL and domain label rather than a final URL, full page title, author, language, or access/paywall status. V2 records the limitation and fails unknown authority closed.
- Claim relevance is deterministic lexical/date/institutional matching. It is auditable but conservative and may route valid evidence to review rather than infer authority.
- Publisher priors require maintenance. Domain patterns support new institutions, while unverified organizations remain unclassified to prevent silent trust expansion.
- Same-parent independence is deterministic. Syndication and copied-source dependence cannot always be proven from domain-only grounding metadata.
- Search-provider results vary. Bounded retries and one targeted escalation contain cost; failed attempts remain review/non-public rather than being forced through.
- The two current published timelines predate V2 and fail its retrospective standard. They should be considered for a separately authorized evidence-strengthening workflow, not silently rewritten by this goal.

## Final discovery state and certification

Autonomous discovery is ENABLED on `0 3 * * *` UTC. Priority, autonomous, and institutional queues are RUNNING. Existing exceptional-review backlog suppression remains active, and the current autonomous exceptional-review backlog is zero.

**SOURCE AUTHORITY V2: CERTIFIED**
