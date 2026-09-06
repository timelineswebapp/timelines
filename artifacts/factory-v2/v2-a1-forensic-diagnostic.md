# TL-KF-V2-A1 forensic diagnostic

Generated: 2026-09-06
Execution boundary: SHADOW only
Corpus: `timelines-clean-2026-09-v1`
Source evidence: immutable Firestore V2-A artifacts and `v2-a-shadow-fixtures-1788651705035.json`

## Conclusion before remediation

The primary claim-yield failure is the combination of an all-or-nothing claim-array contract and non-relevant evidence packet construction. A single invalid claim rejects every otherwise valid claim returned for a source, then repeats the whole large task in bounded semantic repair. Packets are the first 30 segments of a document rather than the segments most relevant to a Research Map question; several packets begin with navigation, titles, or publisher boilerplate. Source selection is global and publisher-diverse, not question-driven. It therefore admits low-value documents after only a few known authorities and cannot stop by question sufficiency.

The Source Authority evaluator is not the primary yield bottleneck. It correctly supported narrow routine facts backed by a definitive primary source in the Berlin and Cuban runs, and correctly excluded Wikipedia and provisional publishers. Most potentially useful assertions never reached authority evaluation because their complete extraction response was discarded.

## Evidence by fixture

| Fixture / run | Last completed path | Persistent evidence | Proven failure |
|---|---|---|---|
| World Wide Web / `f7e05763-35ed-4aca-b3c0-5e3258cb4609` | Scope → Research Map → 5 grounded queries → 54 snapshots → 5,177 segments → extraction → authority → resolution | 75 discovered URLs, 54 snapshots, 6 selected extraction sources, 13 extraction executions, 1 accepted claim, 0 supported claims, 0 events, 884,321 ms | Five of six source tasks failed or exhausted repair; the only accepted assertion was Wikipedia title metadata and was correctly rejected. |
| Berlin Wall / `e00f78c6-3196-407e-ae25-b3b80f9d8af2` | Scope → Research Map → 5 grounded queries → 44 snapshots → 4,298 segments → 6 claims → authority | 12 extraction executions; six claims; two definitive-primary claims supported | Entity construction rejected duplicate `identityEvidenceSegmentIds`. The committed deduplication fix had not been exercised by this process. |
| Apollo 11 / `77bcb1e2-35d7-48e3-8397-2c8f0d527934` | Valid Scope; Research Map never sealed | 1 Scope call; 3 invalid Research Map calls; 126,626 ms in Research Map | Model was required to manufacture IDs and exact persistence enums; outputs used IDs shorter than three characters and `DESCRIPTION`. |
| Cuban Missile Crisis / `3539d04c-10ab-4422-a014-464cde2b5049` | Scope → Research Map → 5 grounded queries → 39 snapshots → 3,512 segments → 6 claims → authority | 11 extraction executions; six claims; two narrow definitive-primary claims supported | Two extraction batches exhausted atomicity repair, one timed out, and entity construction hit the duplicate-evidence defect. Several accepted claims were irrelevant page/title metadata, proving poor packet relevance. |
| Apollo 13 / `fd0ecb9b-ab3a-4485-b5b3-a5bceb7d1091` | Valid Scope; Research Map never sealed | 1 Scope call; 3 invalid Research Map calls; 103,799 ms in Research Map | Model returned unsupported `FACTUAL` and `CAUSAL` categories because the provider task carried persistence taxonomy and references. |

## Representative source → evidence → extraction traces

### World Wide Web: strong W3C source discarded

- Snapshot `snapshot-bc2c29f5360275d0dd53f87cad9e0a5e5c00f7809997e836f07805cc8eaaf394`
- Source: `https://www.w3.org/History/1989/proposal-msw.html`
- Retrieved HTML: 39,795 bytes; at least 200 exact segments.
- First evidence packet contained 30 segments / 4,964 characters. It began with the document title, `Tim Berners-Lee, CERN`, `March 1989, May 1990`, and the proposal abstract, so it contained historically useful exact evidence.
- Extraction ended with `This operation was aborted`; zero assertions from this authoritative source reached claim-level evaluation.

### World Wide Web: weak/noisy source packet

- Snapshot `snapshot-4816a4fab52baf0e03ca17c50d5923cf092feea5413a03c59ca5cbd5521a3a51`
- Source: `https://www.identity.org/web1-and-web2/`
- First packet contained only 1,933 characters and began with `Skip to content`, `HOME`, `BLOG`, and `ABOUT`.
- Three extraction attempts were rejected because individual proposed assertions contained conjunctions. The complete array was discarded.

### Cuban Missile Crisis: authority works after extraction

- National Archives snapshot `snapshot-2cd0789cd2ef70e868e4b694c4c8e496f59e2ab05bb1fc81a8c71b2dd1828313` produced two narrow title/identity claims.
- Both evidence edges were `STRONG`; deterministic evaluation returned `SUPPORTED` with `DEFINITIVE_PRIMARY` and `DIRECT_STRONG_SOURCE`.
- This proves the definitive-primary exception works, while also proving extraction relevance is inadequate: page-title metadata passed instead of historical facts.
- Office of the Historian snapshot `snapshot-1f8cb3cb17c68e4bb99dc102cccda5a358257ad9d36a15c0ece5e79b2cc64a44` produced a large response in which multiple individual assertions violated the regex atomicity rule. Three complete responses were discarded.

## Research Map contract classification

| Field | Owner after remediation | Reason |
|---|---|---|
| phase/dimension label and rationale | Semantic model output | Historical framing requires judgment. |
| question text, expected semantic categories, source/authority intent, contested/date-critical flags, priority | Semantic model output | These define the research burden. |
| IDs, version, default research state | Deterministic software | Mechanical persistence structure. |
| phase/dimension references | Deterministic label resolution | The model should associate labels; software resolves stable IDs. |
| enum spelling and unambiguous category aliases | Deterministic normalization | `FACTUAL`/`DESCRIPTION` are not historical decisions; invalid arbitrary categories remain rejected. |
| coverage/cardinality enforcement | Deterministic validation | No provider decoder state is needed. |
| hashes, provenance, immutable envelope | Deterministic software | Authority-bearing persistence invariant. |

## Per-stage latency and model-call evidence

| Fixture | Scope | Research Map | Query plan | Grounding | Claim extraction |
|---|---:|---:|---:|---:|---:|
| World Wide Web | 37,120 ms / 1 | 48,633 ms / 2 | 8,696 ms / 1 | 73,544 ms / 5 | 659,991 ms / 13 |
| Berlin Wall | 21,505 ms / 2 | 45,672 ms / 2 | 9,150 ms / 1 | 81,714 ms / 5 | 316,147 ms / 12 |
| Apollo 11 | 13,547 ms / 1 | 126,626 ms / 3 | — | — | — |
| Cuban Missile Crisis | 12,812 ms / 1 | 115,891 ms / 2 | 13,307 ms / 2 | 92,409 ms / 5 | 193,557 ms / 11 |
| Apollo 13 | 25,694 ms / 1 | 103,799 ms / 3 | — | — | — |

Retrieval and Firestore/Cloud Storage latency were not separately instrumented in these immutable runs and cannot be reconstructed exactly. The report does not invent those measurements. Whole-run minus recorded model latency includes retrieval, storage, Firestore, local processing, and orchestration overhead; it is not attributed to one component.

## Rejection taxonomy proven by immutable failure records

- Claim extraction: `COMPOUND_CONJUNCTION`, `MULTIPLE_SENTENCES`, unterminated JSON, and provider abort/timeout.
- Research Map: short model-generated IDs and unsupported enum labels.
- Authority: `WIKIPEDIA_EXCLUDED` and `WEAK_AUTHORITY` behaved as policy requires.
- Entity resolution: duplicate identity evidence IDs caused Berlin and Cuban failures; a later code deduplication exists but lacks fresh real-fixture proof.
- Relevance: accepted Cuban assertions such as page titles, an author biography, and `EXCOMM is Wikipedia` were structurally valid but irrelevant to the locked research questions.

## Telemetry limitation discovered

`v2ModelExecutions` persists prompt/response hashes, validation state, token usage, and latency, but not the bounded raw provider response or a source/question input reference. Therefore exact invalid Scope/Research Map/claim response bodies and exact source-to-execution mapping cannot be recovered from these completed runs. Failure records preserve only bounded validation messages and a claim-extraction snapshot ID. Remediation must add private, bounded diagnostic provenance sufficient to audit future fixture executions without storing unrestricted model payloads in Firestore.

## Required corrective direction

1. Make Research Map provider output semantic-only; deterministically assign IDs, resolve label references, normalize only explicit safe aliases, and assemble the authoritative Zod artifact.
2. Introduce deterministic question-aware source admission and evidence-segment ranking before extraction; cap packet size by characters and segments while preserving exact IDs/offsets.
3. Extract per question/source packet with a small response ceiling. Validate claims independently so one malformed assertion does not destroy valid siblings; structural normalization must not alter meaning.
4. Replace the conjunction heuristic as a hard universal sentence rule with typed evidentiary-burden checks. Preserve bounded semantic repair for genuinely compound historical meaning.
5. Accumulate equivalent proposition evidence across sources before authority evaluation.
6. Add question coverage state and stop new acquisition/extraction work when critical/important burdens are satisfied.
7. Add cache lookup/revalidation disposition, host-level retrieval suppression, and an authoritative whole-run deadline that closes operation state without leaving `RUNNING` residue.

No security or authority threshold is weakened by this diagnosis.
