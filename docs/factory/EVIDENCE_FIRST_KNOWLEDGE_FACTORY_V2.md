# Evidence-First Knowledge Factory V2

Design ID: `TL-KNOWLEDGE-FACTORY-V2-DESIGN-001`

Status: **LOCKED DESIGN AUTHORITY**

Authority level: Tier-2 Factory Architecture, subordinate to the Product Constitution, Institutional Architecture, Publication Constitution, Historical Library Constitution, Factory Constitution, and active corpus isolation policy

Decision date: 2026-09-05

Implementation status: **NOT IMPLEMENTED**

## 1. Decision

TiMELiNES shall adopt an evidence-first knowledge-acquisition method for the next Factory generation.

The core hypothesis is accepted with one qualification:

> Evidence generates candidate claims and candidate historical events. Scope determines what evidence must be sought. Editorial judgment selects a Timeline View from verified canonical events. Evidence alone does not determine scope, significance, or narrative.

The current approach asks one model context to research, define scope, select events, compose a timeline, and then survive downstream validation. Production evidence shows that this validates several decisive choices too late. V2 separates those choices into versioned, fail-closed artifacts and prevents prose generation until the historical event set is locked.

This design changes the internal method of the Factory and Editorial Intelligence. It does not change the permanent institutional chain:

```text
Factory
  -> Editorial Intelligence
    -> Historical Publication Package
      -> Governance
        -> Historical Library
          -> Published Memory
            -> Projection Engine
              -> Search
                -> Platform Read Models
                  -> Public APIs
                    -> Public Platform
```

Factory records described as `canonical` in this document are **canonicalized candidates** while they remain in Production Memory. Canonical authority is created only by Governance approval and Historical Library admission. Factory never publishes.

## 2. Evidence for the decision

### 2.1 Repository and production findings

| Evidence | What worked | What failed | V2 consequence |
|---|---|---|---|
| World Wide Web | Grounded research, immutable lineage, and publication path | Early-history concentration and a 2004 endpoint for an ongoing subject | Scope and research coverage must precede event selection. |
| Berlin Wall | Evidence and the candidate were sound | Contextual themes were incorrectly treated as missing chronology events | Research questions, contextual knowledge, and chronology eligibility must be separate. |
| Apollo 11 generation 1 | Source Authority V2 passed with strong NASA and independent evidence | State/legacy material entered the event spine and coarse dates produced false ordering | Event semantics and temporal intervals must be resolved before selection and writing. |
| Apollo 11 generation 2 | Immutable revision, Historical Library, Published Memory, and projection replacement worked | The correction was downstream of an avoidable acquisition/composition defect | Preserve revision machinery, but prevent the defect before the first lock. |
| Cuban Missile Crisis | Quality and authority gates failed closed | The plan selected 27 items against the 20-event maximum, still omitted material events, and lacked adequate evidence | Research inventory and publication selection must be separate bounded stages. |
| Apollo 13 | EVENT/STATE separation failed closed correctly | Scope expanded to 1995; dates and dimension membership were inconsistent; operational evidence was weak | Scope must be immutable during downstream stages; selected-event evidence completion must occur before writing. |

### 2.2 Critical evaluation

The production problem is not that validation is weak. Timeline Quality V2/V3 and Source Authority V2 correctly reject bad candidates. The problem is that the candidate timeline is currently the unit around which research, evidence, and repair are organized.

Evidence-first acquisition is therefore necessary, but a naive evidence-first system would still fail:

- Easily found evidence can overrepresent well-digitized institutions, English-language sources, and early periods.
- Source density is not historical significance.
- A source passage does not define event identity.
- Independent evidence can support facts that are outside the title's intended scope.
- Verified facts can still be arranged into a poor or misleading Timeline View.

V2 therefore uses three independent controls:

1. a locked Scope Contract defines the inquiry;
2. claim-level evidence defines what can be asserted;
3. a significance-and-coverage protocol defines what enters the Timeline View.

### 2.3 External review evaluation

The independent architecture review is useful design input, not authority.

| Proposal | V2 decision | Reason |
|---|---|---|
| Separate knowledge acquisition, event canonicalization, editorial synthesis, and prose | Accept | Production defects map to these distinct responsibilities. |
| Rigid source-weight arithmetic | Reject | Authority is claim-relative and multidimensional; arithmetic would hide judgment and provenance. |
| Arbitrary confidence percentages | Reject | The repository has no calibrated historical probability model. Persist findings, uncertainty, and verdicts instead. |
| Universal two-source rule | Reject | A definitive primary record can establish a narrow fact; interpretive or contested claims may require more than two. |
| Equal temporal buckets | Reject | V1 evidence supports subject-derived eras and V2 retains that doctrine. |
| Absolute Wikipedia prohibition | Reject for research; accept for locked publication evidence | Wikipedia remains useful for orientation and reference discovery, but it cannot satisfy a public claim burden. |
| Simple domain whitelist | Reject | Verified publisher priors assist classification but cannot establish claim relevance. |
| Fixed vector-similarity identity threshold | Reject | Event and claim identity require typed, temporal, entity, location, and evidence checks. |
| New graph database | Reject now | No repository-proven multi-hop query justifies a second authority store or cross-store recovery burden. |

## 3. Authority reconciliation

### 3.1 Contracts that remain binding

- TiMELiNES remains a Chronological Knowledge Platform.
- Historical Objects provide context; Participation provides meaning; Milestones provide chronology; Timeline Views provide narrative.
- Milestone is the domain term and Event is the current persistence/public term.
- Factory owns Production Memory and candidate knowledge only.
- Editorial Intelligence is Factory-owned technical processing and has no canonical authority.
- Governance is the sole editorial approval and publication-readiness authority.
- Historical Library alone admits canonical authority and owns Published Memory.
- Published Memory, admissions, decisions, evidence lineage, and revisions remain immutable and reconstructable.
- Projection Engine transforms approved inputs deterministically and creates no historical authority.
- Topic Ledger remains the corpus-scoped deduplication, priority, lease, generation, and work-state authority.
- All three entry paths converge on one Factory.
- The active corpus remains structurally isolated below `corpora/{ACTIVE_CORPUS_ID}` with `NO_LEGACY_CONTENT_REUSE`.
- Source Authority V2's claim-sensitive burden, publisher-parent independence, conflict escalation, exact snapshot binding, and final institutional re-verification remain binding.
- Timeline Quality V2 omission semantics remain binding.
- Timeline Quality V3's EVENT-only spine, precision intervals, stable same-day ordering, and no-fabricated-precision rules are adopted as V2 design rules even though V3 has not earned live certification.
- Public DTOs, public IDs, current routes, Published Memory, and projections are unchanged by this design.

### 3.2 Existing assumptions superseded by V2

- A broad grounded response is not a sufficient durable research corpus.
- A generated timeline is not the primary research artifact.
- Event descriptions are not atomic claims.
- Event-level URLs are not adequate claim provenance.
- Structural evidence validation is not an evidence-authority verdict.
- A model may not define or amend scope while composing or repairing a timeline.
- A model may not select publication events before canonical event resolution.
- A writer may not create event membership, dates, facts, causal links, or citations.
- Timeline-level repair loops may not be used to compensate for missing historical knowledge.
- Source credibility is not a universal numeric score or simple domain whitelist.
- URL count is not corroboration; publisher-parent and content dependence govern independence.
- One event per output row is not proof of canonical event identity.
- Search-result snippets and provider redirect URLs are not automatically complete source-document snapshots.
- Timeline membership is not factual authority. It is a Factory-owned Editorial Intelligence view specification over canonical events.

### 3.3 Constitutional clarification required before implementation

The repository contains contradictory language about Milestones in `docs/architecture/PUBLICATION_CONSTITUTION.md`: its non-canonical list says Milestones are projections, while Law 4 correctly says Milestones are canonical chronological authority admitted by the Historical Library. V2 follows Law 4, the Product Constitution, the Domain Model, and the later explicit canonical-equivalence clause.

Implementation must first reconcile that wording. It must also lock this distinction:

- a Canonical Event/Milestone is historical authority after admission;
- a Timeline View Specification is a Factory-owned technical instruction, not historical fact and not part of Governance authority mapping;
- Projection Engine mechanically materializes the specification and must not invent membership or significance.

## 4. Canonical V2 flow

```text
Topic Entry
  -> Topic Ledger
    -> Scope Contract
      -> Existing Knowledge Reconnaissance
        -> Research Map
          -> Bounded Query Plan
            -> Source Discovery
              -> Source Retrieval and Immutable Snapshots
                -> Atomic Claim Extraction
                  -> Claim-Level Source Authority and Validation
                    -> Claim Conflict Resolution
                      -> Entity Resolution
                        -> Candidate Event Resolution
                          -> Canonicalized Event Candidates
                            -> Significance and Coverage Selection
                              -> Targeted Evidence Completion
                                -> Locked Event Skeleton
                                  -> Constrained Writer
                                    -> Prose Claim Check
                                      -> Timeline Quality Final Gate
                                        -> Source Authority Final Gate
                                          -> Historical Publication Package
                                            -> Governance
                                              -> Historical Library
                                                -> Published Memory
                                                  -> Projections
                                                    -> Public Platform
```

Source Authority is not delayed until the named final gate. Its classification and burden rules operate during source admission, claim validation, conflict resolution, and targeted completion. The final gate re-verifies the exact immutable bundle after prose generation; it does not redo research.

This ordering intentionally differs from the proposed input sequence in three ways:

- Topic Ledger precedes all Factory work so deduplication, origin, generation, lease, and corpus isolation remain authoritative.
- Existing Knowledge Reconnaissance precedes the Research Map so admitted reusable knowledge reduces duplicate research and makes actual gaps explicit.
- Source Authority is continuous during claim formation and completion, with only an integrity recheck after writing; authority cannot be postponed until a finished timeline exists.

## 5. Entry paths and Topic Ledger

The three entry paths remain:

| Origin | Priority | Intake behavior |
|---|---:|---|
| Founder/Admin | 1000 | Immediate priority queue after ledger deduplication. |
| User request | 1000 | Immediate priority queue after validation, rate limiting, and ledger deduplication. |
| Autonomous discovery | 100 | Bounded promotion only when autonomous review suppression permits it. |

All origins create the same corpus-scoped topic identity and enter the same state machine. Origin may affect priority and audit metadata only. It must never choose a different research, evidence, selection, writing, or publication policy.

The ledger stores mutable work state and pointers to the current immutable artifact versions. It does not embed large artifacts or unbounded histories.

Proposed V2 stages:

```text
QUEUED
  -> SCOPING
  -> SCOPE_LOCKED
  -> MAPPING
  -> ACQUIRING
  -> CLAIM_EXTRACTION
  -> CLAIM_RESOLUTION
  -> EVENT_RESOLUTION
  -> SELECTION
  -> EVIDENCE_COMPLETION
  -> EVENT_SET_LOCKED
  -> WRITING
  -> FINAL_VALIDATION
  -> GOVERNANCE_READY | AWAITING_REVIEW
  -> PUBLISHED | FAILED | CANCELLED
```

## 6. Scope Contract

### 6.1 Purpose

The Scope Contract is the immutable boundary for one Factory generation. It is created before research planning and referenced by every downstream artifact.

### 6.2 Schema

```ts
type ScopeContract = {
  scopeContractId: string;             // immutable version ID
  topicId: string;
  generation: number;
  version: number;
  status: "PROPOSED" | "LOCKED" | "SUPERSEDED";
  title: string;
  language: string;
  topicClass:
    | "CLOSED_EPISODE"
    | "ONGOING_SUBJECT"
    | "BIOGRAPHY"
    | "INSTITUTION"
    | "LONG_DURATION";
  subjectDefinition: string;
  includedQuestions: string[];
  excludedQuestions: string[];
  temporal: {
    chronologyStart: HistoricalBoundary;
    chronologyEnd: HistoricalBoundary | null;
    ongoingAsOf: string | null;
    contextBefore: HistoricalBoundary | null;
    contextAfter: HistoricalBoundary | null;
    precursorRule: string;
    aftermathRule: string;
  };
  spatial: {
    includedPlaces: EntityRef[];
    excludedPlaces: EntityRef[];
    boundaryRule: string;
  };
  centralEntities: EntityRef[];
  requiredDimensions: ResearchDimension[];
  expectedPhases: HistoricalPhase[];
  granularity: "OVERVIEW" | "STANDARD" | "DETAILED";
  eventCountPolicy: {
    targetMinimum: number;              // normally 10
    hardMaximum: 20;
    lowCountExceptionReason: string | null;
  };
  explicitExclusions: string[];
  knownUncertainties: ScopeUncertainty[];
  researchBudget: ResearchBudget;
  proposedBy: ModelExecutionRef | ActorRef;
  approvedByPolicy: string;
  parentScopeContractId: string | null;
  amendmentReason: string | null;
  payloadHash: string;
  createdAt: string;
};

type HistoricalBoundary = {
  label: string;
  earliest: HistoricalDate;
  latest: HistoricalDate;
  precision: "DAY" | "MONTH" | "YEAR" | "APPROXIMATE";
  claimRef: string | null;
};
```

### 6.3 Deterministic enforcement

- Every research task, claim, event candidate, selection, and writer artifact must reference the exact `scopeContractId` and payload hash.
- Context windows permit research but do not make a claim chronology-eligible.
- Closed episodes reject any event whose supported temporal interval is not wholly within the chronology boundary. Overlap is not enough.
- Ongoing subjects require an explicit `ongoingAsOf` date and a terminal phase/question describing the modern state.
- Candidate dimensions and phases must resolve to IDs declared by the contract.
- The hard event maximum is 20. Standard views target 10–20. A tightly bounded topic may use 6–9 only when the low-count exception is locked before selection.
- Downstream prompts receive the contract as read-only data and are forbidden from creating substitute phases, dimensions, boundaries, or exclusions.

### 6.4 Amendment protocol

Research may prove a scope materially wrong. It may not mutate it.

1. The current run enters `SCOPE_AMENDMENT_REQUIRED` and stops event resolution.
2. The system creates an immutable amendment proposal containing the evidence and affected fields.
3. Deterministic validation confirms that the proposal does not merely broaden scope to rescue available evidence.
4. A policy-approved minor amendment or a human-approved material amendment creates a new contract version.
5. All downstream artifacts tied to the old version are abandoned, never rewritten.
6. Existing source snapshots may be reused if their provenance remains valid; selection, locks, and prose may not be reused.

Material amendments include topic class, chronology boundaries, central subject, geography, granularity, or explicit exclusions. Model proposals never self-approve material amendments.

## 7. Existing knowledge reconnaissance

Before external acquisition, the Factory performs bounded searches of admitted canonical events, entities, claims, and sources in the active corpus.

Reconnaissance returns:

- exact deterministic identity matches;
- alias/external-ID matches;
- event candidates inside the scope's temporal and spatial boundaries;
- admitted claims and their evidence verdicts;
- weak, disputed, superseded, or missing knowledge;
- reusable source snapshots.

Reused knowledge must preserve the original admitted version. Reuse never copies prose into a new claim.

Evidence remains sufficient when the claim is historical, the cited snapshot and publisher identity remain intact, no later admitted conflict exists, and the new use does not raise the claim's risk burden. Revalidation is required when a source version changed, the claim is mutable or retrospective, a higher-risk use is proposed, a conflict exists, or the evidence cannot be retrieved from preserved storage.

## 8. Research Map

### 8.1 Purpose

The Research Map asks `what must be known to understand this subject?`, not `which events should be published?`

### 8.2 Schema

```ts
type ResearchMap = {
  researchMapId: string;
  topicId: string;
  scopeContractId: string;
  version: number;
  phases: Array<{
    phaseId: string;
    label: string;
    temporalRule: string;
    required: boolean;
    rationale: string;
  }>;
  dimensions: Array<{
    dimensionId: string;
    label: string;
    required: boolean;
    rationale: string;
  }>;
  entities: Array<{
    entityRef: EntityRef | null;
    unresolvedName: string | null;
    role: string;
    aliases: string[];
    languages: string[];
  }>;
  questions: Array<{
    questionId: string;
    text: string;
    phaseIds: string[];
    dimensionIds: string[];
    claimTypesExpected: ClaimType[];
    likelySourceClasses: SourceClass[];
    expectedAuthorities: AuthorityExpectation[];
    languages: string[];
    geography: string[];
    contested: boolean;
    dateCritical: boolean;
    priority: "CRITICAL" | "IMPORTANT" | "SUPPORTING";
    state: "UNRESEARCHED" | "PARTIAL" | "SATISFIED" | "BLOCKED";
  }>;
  terminology: Array<{
    term: string;
    aliases: string[];
    language: string;
    ambiguousWith: string[];
  }>;
  knownUncertainty: string[];
  payloadHash: string;
  immutable: true;
};
```

Dimensions are derived from the subject. Political, institutional, technological, social, cultural, military, scientific, and economic are available vocabulary, not mandatory checkboxes.

Every required phase must contain at least one critical or important question. Every required dimension must be exercised by at least one question. A Research Map with empty required cells cannot advance.

## 9. Search and source acquisition

### 9.1 Search roles

V2 uses five query roles in this order:

1. **Orientation**: terminology, phases, institutions, and contested questions.
2. **Dimension/phase acquisition**: specific Research Map questions.
3. **Authority-targeted acquisition**: original institutional records, archives, scholarship, edited references, or appropriate journalism.
4. **Source-specific retrieval**: acquire and snapshot a known document by canonical URL.
5. **Evidence completion**: repair only the burden of provisionally selected events.

Broad search is limited to orientation. It cannot be the entire research corpus. Event-targeted search occurs only after claim/event gaps have been identified; it must not broaden the Scope Contract.

### 9.2 Google Search Grounding contract

The current Vertex implementation correctly uses `googleSearch` and receives `webSearchQueries`, `groundingChunks`, and `groundingSupports`. Google documents that grounding metadata can be absent when relevance or response coverage is insufficient. It exposes supporting web URI/title/domain metadata and response spans, but that is not a guarantee of a complete, canonical page snapshot.

Consequences:

- A grounding call without attributable support is a failed acquisition, not an ungrounded success.
- Provider redirect URLs, domain labels, and generated response spans remain discovery provenance.
- The acquisition layer must independently resolve and retrieve an allowed source document before it is treated as a durable full-document snapshot.
- `site:` and similar operators may be proposed as query hints, but policy must not assume that the model executes them exactly like a user-authored Google query.
- Actual `webSearchQueries` returned by the provider are persisted and charged against the query budget.
- Search suggestions and provider-specific display obligations must be preserved where applicable.

Official capability references:

- [Grounding with Google Search](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/ground-with-google-search)
- [Vertex GenerateContent grounding metadata](https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/GenerateContentResponse)
- [Vertex URL context](https://cloud.google.com/vertex-ai/generative-ai/docs/url-context)

URL context may assist extraction from supplied URLs, but a provider-derived analysis is not the immutable raw source. The system-owned snapshot and its content hash remain the durable record.

### 9.3 Default bounded budget

The Scope Contract owns the budget. The standard default is:

```text
orientation grounded calls                 1
phase/dimension acquisition calls          3
authority-targeted acquisition calls       1
targeted evidence-completion calls         2
maximum total grounded calls               7
maximum provider-reported search queries  40
maximum retrieved source documents        60
maximum extracted atomic claims           300
maximum semantic repair rounds             2
provider transport attempts per call       3
```

Calls for independent Research Map work items may run concurrently with a maximum concurrency of three. Infrastructure retries do not permit additional semantic searches. A budget increase requires a new Scope Contract version or human research escalation; the system never enters a source-count maximization loop.

Performance target for a standard topic is p95 under 12 minutes and an absolute worker wall-time under 20 minutes, excluding human review.

### 9.4 Query generation and deduplication

Each query plan item includes question IDs, intended source class, language, geography, aliases, and expected result. Deterministic software normalizes Unicode and whitespace, lowercases for comparison, removes duplicate tokens, and deduplicates exact normalized queries. It does not rewrite historical names or translate proper nouns without an alias record.

Results are deduplicated by canonical URL and content hash. Different URLs with the same content hash form one dependence group. The system preserves all retrieval URLs for audit.

### 9.5 Canonical URL and retrieval policy

- Permit HTTPS only.
- Resolve redirects with a bounded hop count and record every hop.
- Remove known tracking parameters; preserve parameters that select edition, language, document, page, or version.
- Prefer publisher-declared canonical URLs when retrievable.
- Normalize DOI, Handle, ISBN edition, archive, and institutional identifiers into external-identifier records without replacing the publisher URL.
- Respect access controls, robots policy, licenses, and paywalls. Never bypass them.
- If full retrieval is unavailable, persist an access-limited discovery record. It cannot masquerade as a full snapshot.
- Store large or binary immutable bodies in the existing private, versioned Cloud Storage archive and keep only bounded metadata and object references in Firestore.

Before network retrieval, the acquisition service checks the source registry by canonical URL and content validators. A cached snapshot may be reused only when the claim's freshness rule permits it and the publisher reports no version change. `ETag`, `Last-Modified`, retrieval status, and content hash are recorded when available. Cache reuse is explicit provenance, never a silent fallback after a failed required-freshness check.

### 9.6 Freshness and language

Historical evidence does not expire on an arbitrary TTL. Freshness is claim-sensitive:

- immutable archival records remain valid unless superseded or discredited;
- living institutional pages are re-snapshotted when used after a detected version change;
- ongoing subjects require research current to `ongoingAsOf`;
- statistics, legal status, officeholders, active conflicts, and retrospective interpretations require current-source checks;
- dead links use preserved snapshots and are marked unavailable at retrieval time.

Original-language evidence is preferred where authoritative. Machine or model translation is a derivative artifact linked to the original segment and translator/model provenance; it is never an independent source. Translated claims preserve the original-language passage and a reviewable translation.

## 10. Source and Authority Registry

TiMELiNES shall maintain reusable source/publisher priors. It is a registry of evidence about publishers, not a whitelist.

```ts
type PublisherAuthorityRecord = {
  publisherId: string;
  canonicalName: string;
  aliases: string[];
  parentPublisherId: string | null;
  institutionType:
    | "ARCHIVE" | "GOVERNMENT" | "MUSEUM" | "UNIVERSITY"
    | "SCHOLARLY_PUBLISHER" | "STANDARDS_BODY" | "NEWSROOM"
    | "EDITED_REFERENCE" | "SPECIALIST" | "OTHER";
  authorityDomains: string[];
  geographicScope: string[];
  languages: string[];
  primarySecondaryTendency: "PRIMARY" | "SECONDARY" | "MIXED";
  knownDomains: string[];
  externalIdentifiers: ExternalIdentifier[];
  independenceGroupId: string;
  accessLimitations: string[];
  reliabilityNotes: AuthorityFinding[];
  state: "PROVISIONAL" | "VERIFIED" | "DISPUTED" | "RETIRED";
  currentVersionId: string;
};
```

An unseen source begins `UNCLASSIFIED`. A deterministic candidate assessment may use verifiable publisher identity, parent organization, institutional mandate, editorial process, academic indexing, and external authority identifiers. The model may propose metadata and evidence; it may not assign a verified prior. A reviewer or approved registry policy admits a version. Unknown but excellent sources are therefore discoverable without being trusted merely because of a domain pattern.

The registry never determines claim sufficiency alone. A NASA source can be authoritative for an Apollo launch date and irrelevant to an unrelated revolution claim.

## 11. Wikipedia policy

TiMELiNES adopts **discovery and reference-link harvesting only**.

Wikipedia may be used for:

- orientation;
- terminology and alias discovery;
- discovering named primary and secondary references;
- identifying questions and possible conflicts that must be researched elsewhere.

Wikipedia may not:

- enter the approved evidence set of a locked event;
- satisfy any claim burden;
- count as independent corroboration;
- resolve a conflict;
- raise a source or publisher authority verdict;
- be converted into apparent independence by citing its underlying statement through another Wikipedia-derived page.

Reference links discovered through Wikipedia must be independently retrieved, snapshotted, classified, and evaluated. Discovery lineage records the Wikipedia page so dependence is visible. This is stricter than Source Authority V2's current orientation treatment because excluding it from the locked evidence set removes ambiguity between `present in research` and `accepted as publication evidence`.

This is not a claim that Wikipedia is always inaccurate. It is a provenance decision: TiMELiNES should cite the underlying authority and prevent tertiary-source laundering.

## 12. Source documents and snapshots

`Source` identifies a work or web resource. `SourceSnapshot` preserves one retrieved version. `Publisher` owns publication identity.

```ts
type SourceDocument = {
  sourceId: string;
  publisherId: string | null;
  canonicalUrl: string;
  title: string;
  authors: EntityRef[];                  // bounded; overflow uses source-author edges
  publicationDate: HistoricalDate | null;
  sourceClass: SourceClass;
  language: string;
  primarySecondaryRole: "PRIMARY" | "SECONDARY" | "MIXED" | "UNKNOWN";
  authorityDomains: string[];
  access: "OPEN" | "LIMITED" | "PAYWALLED" | "UNAVAILABLE";
  currentSnapshotId: string | null;
  supersedesSourceId: string | null;
  identityHash: string;
};

type SourceSnapshot = {
  sourceSnapshotId: string;
  sourceId: string;
  retrievalUrl: string;
  resolvedUrl: string;
  redirectChain: string[];
  retrievedAt: string;
  retrievalMethod: "HTTP" | "URL_CONTEXT" | "GROUNDING_EXCERPT" | "ARCHIVE_IMPORT";
  mediaType: string;
  language: string;
  publicationDateObserved: HistoricalDate | null;
  rawObjectRef: string | null;
  extractedTextObjectRef: string | null;
  contentHash: string;
  extractionHash: string | null;
  groundingMetadataRef: string | null;
  license: string | null;
  accessLimitations: string[];
  supersedesSnapshotId: string | null;
  immutable: true;
};
```

A `GROUNDING_EXCERPT` snapshot is explicitly partial. Its exact segment may support discovery or a limited claim only when Source Authority accepts that segment and source identity; it never claims full-document possession.

## 13. Atomic claims

### 13.1 Definition

An Atomic Claim is the smallest historically meaningful assertion that can be independently supported, contradicted, qualified, versioned, or removed without changing another assertion.

`Apollo 11 launched on July 16, 1969` is a date/occurrence claim. `Apollo 11 transformed humanity's relationship with space` is an interpretive consequence claim. They cannot share one undifferentiated evidence verdict.

### 13.2 Schema

```ts
type AtomicClaim = {
  claimId: string;                       // stable fact identity
  claimVersionId: string;                // immutable assertion version
  scopeContractId: string;
  subject: NodeRef;
  predicate: ClaimPredicate;
  object: NodeRef | TypedValue;
  normalizedAssertion: string;
  claimType: ClaimType;
  risk: ClaimRisk;
  temporal: ClaimTemporal | null;
  locations: EntityRef[];
  candidateEventClusterId: string | null;
  qualifiers: ClaimQualifier[];
  extraction: {
    sourceSnapshotId: string;
    evidenceSegmentIds: string[];
    extractor: ModelExecutionRef | "DETERMINISTIC";
    extractionPromptHash: string | null;
  };
  conflictState:
    | "NONE"
    | "RESOLVED"
    | "UNRESOLVED"
    | "HISTORICALLY_CONTESTED"
    | "SUSPECTED_SOURCE_ERROR";
  validationState:
    | "EXTRACTED"
    | "SUPPORTED"
    | "QUALIFIED"
    | "REJECTED"
    | "REVIEW_REQUIRED";
  evidenceVerdictId: string | null;
  supersedesClaimVersionId: string | null;
  payloadHash: string;
  immutable: true;
};
```

The system does not persist arbitrary model confidence percentages. It persists observable evidence characteristics, policy verdicts, unresolved uncertainty, and review state.

### 13.3 Claim types

```text
OCCURRENCE
DATE
IDENTITY
LOCATION
QUANTITY
INSTITUTIONAL_ACTION
RELATIONSHIP
ATTRIBUTION
QUOTATION
CAUSATION
INTERPRETATION
CONSEQUENCE
```

The predicate registry defines permitted subject/object types, qualifiers, and evidence requirements. Quotations require exact text and attributable authorship. Quantities preserve units, ranges, methodology, and competing figures. Causation, interpretation, and consequence never inherit sufficiency from occurrence evidence.

### 13.4 Claim risk

| Risk | Meaning | Default burden |
|---|---|---|
| `ROUTINE` | Narrow, non-controversial fact | One direct, claim-authoritative strong source. |
| `MATERIAL` | Fact essential to event identity, date, or significance | Two independent strong authorities, unless one definitive primary record establishes the exact narrow fact. |
| `INTERPRETIVE` | Causation, meaning, consequence, or attribution beyond a narrow fact | Multiple independent strong secondary authorities; primary self-description is supporting only. |
| `CONTESTED` | Material disagreement exists in credible scholarship or records | Preserve competing claims and their evidence; qualified wording or Governance review. |
| `SENSITIVE` | Claims with exceptional reputational, political, casualty, identity, legal, or harm risk | Multiple independent strong authorities and mandatory human Governance. |

These are policy classes, not scores. A source count alone never satisfies a burden.

## 14. Claim-level evidence

```text
Atomic Claim Version
  -> Claim Evidence Edge
    -> Evidence Segment
      -> Source Snapshot
        -> Source Document
          -> Publisher Authority Version
```

```ts
type EvidenceSegment = {
  evidenceSegmentId: string;
  sourceSnapshotId: string;
  segmentType: "TEXT" | "TABLE_CELL" | "CAPTION" | "METADATA" | "MEDIA_TRANSCRIPT";
  exactText: string;
  startOffset: number | null;
  endOffset: number | null;
  page: string | null;
  section: string | null;
  selector: string | null;
  segmentHash: string;
  extractionMethod: string;
  immutable: true;
};

type ClaimEvidenceEdge = {
  claimEvidenceId: string;
  claimVersionId: string;
  evidenceSegmentId: string;
  relationship: "SUPPORTS" | "CONTRADICTS" | "QUALIFIES" | "MENTIONS";
  relevance: "DIRECT" | "INDIRECT" | "BACKGROUND";
  authorityFindingId: string;
  independenceGroupId: string;
  dependenceBasis: string[];
  evaluator: ModelExecutionRef | "DETERMINISTIC";
  immutable: true;
};
```

An evidence edge cannot exist without a resolvable segment and immutable source snapshot. URLs without segments are provenance pointers, not claim evidence. Multiple URLs sharing a parent publisher, syndicated article, press release, copied text, or common underlying record belong to the same independence group unless evidence proves independence.

## 15. Source Authority V2 integration

Source Authority remains multidimensional:

```text
source quality
  x claim relevance
  x independence
  x claim risk
```

The expression is conceptual, not arithmetic.

Deterministic software owns:

- schema and referential integrity;
- canonical URL/content deduplication;
- known publisher-parent grouping;
- registry-version lookup;
- exact segment/snapshot binding;
- required burden evaluation;
- exclusion of prohibited evidence classes;
- conflict state and routine/exceptional routing;
- payload hashes and immutable lineage.

Gemini may assist with:

- extracting candidate atomic claims;
- assessing whether a passage directly supports a claim;
- identifying possible publisher relationships or syndication for verification;
- classifying primary/secondary role for the exact use;
- detecting semantic conflict;
- proposing qualified wording.

Gemini never owns the final authority verdict, source-registry verification, independence count, risk policy, or Governance outcome.

## 16. Claim conflicts

Every direct authoritative contradiction creates a conflict set. The system may not select the most convenient value.

Resolution protocol:

1. Normalize comparable value, unit, temporal precision, entity, and scope.
2. Exclude weak or irrelevant material from manufacturing a false conflict, while preserving it in research history.
3. Determine whether sources report different versions, estimates, jurisdictions, definitions, or observation times.
4. Seek one bounded targeted completion pass when the conflict is material.
5. Produce one of four outcomes:

| Outcome | Rule |
|---|---|
| `RESOLVED` | A documented source error, superseded record, definition mismatch, or stronger direct record resolves the conflict. |
| `QUALIFIED_SINGLE_CLAIM` | Evidence supports a bounded range or explicitly qualified statement. |
| `HISTORICALLY_CONTESTED` | Credible interpretations or estimates remain; preserve parallel claim versions and qualified public wording. |
| `UNRESOLVED` | The event cannot be locked; replace it or route to human Governance. |

Sensitive conflicts and unresolved material conflicts always require human Governance. Source Authority may recommend but does not erase disagreement.

## 17. Claim clustering

Candidate duplication is detected using:

- resolved subject/entity IDs;
- predicate identity;
- normalized typed values;
- compatible temporal intervals;
- compatible locations;
- shared evidence segments and source dependence;
- semantic similarity as a review signal only.

Deterministic exact identity keys merge only exact compatible assertions. Gemini may propose `same_claim`, `related_claim`, or `distinct_claim`; deterministic validation verifies type, dates, entities, and values. No fixed embedding threshold may create or merge historical authority.

## 18. Canonical entities

V2 uses the constitution's eight Historical Object types:

```text
Person
Institution
Place
Technology
Publication
Conflict
Movement
Period
```

Organizations and polities are represented as `Institution` when institutional identity is meant. A territory or geographic place is a separate `Place`. Works and documents are `Publication`. Abstract concepts remain in the Concept/Tag registry and do not become Historical Objects merely to increase graph density.

Entity identity includes a stable UUID, canonical label, typed aliases, language/script, active temporal interval where relevant, external identifiers, provenance, lifecycle, and immutable versions. Aliases are separate documents to support indexed lookup without unbounded arrays. Same-name entities are never merged without a deterministic identifier or adjudicated identity record.

## 19. Canonical historical events

### 19.1 Event definition

A Canonical Historical Event is a bounded historical occurrence or transition with reusable identity independent of any Timeline View.

```ts
type CanonicalEventVersion = {
  canonicalEventId: string;              // stable UUID after admission
  eventVersionId: string;                // immutable version
  candidateEventId: string;              // Factory candidate identity
  canonicalTitle: string;
  semanticClass: "EVENT";
  eventSubtype: "OCCURRENCE" | "STATE_CHANGE" | "PROCESS_BOUNDARY";
  temporal: {
    start: HistoricalDate;
    end: HistoricalDate | null;
    precision: "DAY" | "MONTH" | "YEAR" | "APPROXIMATE";
    uncertainty: TemporalUncertainty | null;
  };
  locations: EntityRef[];
  participantEntitySummaryIds: string[]; // bounded maximum 20; full set uses edges
  coreClaimVersionIds: string[];          // bounded maximum 20
  supportingClaimVersionIds: string[];    // bounded maximum 40
  authorityState: "FACTORY_CANDIDATE" | "ADMITTED" | "SUPERSEDED" | "RETIRED";
  canonicalizationState: "PROPOSED" | "RESOLVED" | "REVIEW_REQUIRED";
  eventIdentityKey: string;
  parentEventId: string | null;
  supersedesEventVersionId: string | null;
  lineage: ArtifactRef[];
  payloadHash: string;
  immutable: true;
};
```

Event identity is based on the occurrence's core action/transition, central participants, compatible temporal interval, and location/scope—not title text or embedding similarity. The stable UUID survives title changes and new evidence.

### 19.2 Event semantics

- `EVENT` is chronology-eligible.
- `STATE_CHANGE` is a subtype of EVENT when it identifies a bounded transition, such as a treaty entering into force or an institution being dissolved.
- `STATE_LEGACY` describes a continuing condition, preservation state, reputation, or impact; it is knowledge but not a primary-spine event.
- `CONTEXT` explains background or conditions without being the scoped occurrence.
- `FUTURE` records forecasts or scheduled future actions and is never historical chronology.

Keeping STATE_CHANGE under EVENT avoids a second chronology authority while preserving the important distinction between a transition and an enduring state.

### 19.3 Event resolution

- Differently worded accounts merge only when core claims resolve to the same occurrence.
- Same-day events remain distinct when actions, participants, or causal roles differ.
- Closely related sequential actions remain distinct only when each has independent explanatory value at the selected granularity.
- Long-running processes use start/end boundaries and may have child events; a process is not collapsed into an arbitrary date.
- Uncertain dates preserve an interval and may not be silently sorted as January 1.
- Split/merge creates new event versions and explicit lineage; it never deletes prior identity.
- Sub-events link to a parent event but remain reusable only when independently evidenced.

## 20. Graph over Firestore

V2 shall use **graph-over-Firestore**. No Neo4j, Neptune, or other graph database is authorized now.

The required operations are indexed one-hop lookups, alias resolution, bounded event/entity reuse, claim/evidence traversal, timeline membership, and deterministic projection. The repository contains no product-critical arbitrary-depth path query, graph algorithm, or traversal latency requirement that justifies a second database, synchronization path, security boundary, backup system, or operational team.

Firestore is already the active, corpus-isolated system with PITR, delete protection, server-only access, and certified institutional lineage. Edge documents and bounded denormalized lookup keys satisfy current requirements. Firestore's query model requires explicit indexes and bounded queries, and large arrays/maps can cause index fanout; V2 therefore uses edge collections rather than growing relationship arrays. See [Firestore query limitations](https://firebase.google.com/docs/firestore/query-data/queries) and [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices).

| Store | Decision | Evaluation |
|---|---|---|
| Firestore | Select | Already certified and operated; supports the required indexed one-hop lookups and immutable edge documents without data synchronization. |
| Neo4j | Do not add | Strong traversal language, but introduces a second datastore, new operations/recovery, and authority synchronization without a current traversal requirement. |
| Amazon Neptune | Do not add | Adds cross-cloud networking, IAM, cost, and operational ownership while solving no certified product query. |
| Other graph/vector services | Do not add | Similar dual-store costs; vector retrieval may later assist candidate discovery but cannot own identity or authority. |

A graph database may be reconsidered only when a certified requirement demonstrates all of:

- multi-hop traversal is product-critical;
- Firestore projection or bounded breadth-first traversal misses its latency/cost SLO;
- the query cannot be served by a deterministic projection;
- dual-store authority and recovery risks are designed and accepted.

### 20.1 Corpus-scoped collections

All collections live under `corpora/{ACTIVE_CORPUS_ID}`.

| Collection | Role | Mutability |
|---|---|---|
| `topicLedgers` | Deduplication, priority, lease, active artifact pointers | Mutable work-state authority |
| `scopeContracts` | Scope versions and amendments | Immutable versions |
| `researchMaps` | Questions, phases, dimensions, query budget | Immutable versions |
| `researchTasks` | Bounded acquisition work units | Mutable state; immutable completion record |
| `sourceRecords` | Durable source identity/current snapshot pointer | Mutable head with audit |
| `sourceSnapshots` | Retrieved version and archive reference | Immutable |
| `publisherAuthorityRecords` | Current publisher prior pointer | Mutable head with audit |
| `publisherAuthorityVersions` | Evidence for publisher priors | Immutable |
| `evidenceSegments` | Exact source spans | Immutable |
| `atomicClaims` | Stable claim identity/current version pointer | Mutable head with audit |
| `atomicClaimVersions` | Assertion versions | Immutable |
| `claimEvidence` | Support/contradict/qualify edges | Immutable |
| `claimConflictSets` | Conflict adjudication | Immutable resolution versions |
| `canonicalEntities` | Admitted entity head | Mutable pointer only |
| `canonicalEntityVersions` | Admitted/candidate entity versions | Immutable |
| `entityAliases` | Alias-to-entity lookup documents | Versioned edge documents |
| `canonicalEvents` | Admitted event head | Mutable pointer only |
| `canonicalEventVersions` | Candidate/admitted event versions | Immutable |
| `eventClaims` | Event-to-claim edges | Immutable |
| `eventEntities` | Participation edges with role/meaning | Immutable |
| `eventRelations` | Typed event-to-event relationships | Immutable |
| `timelineViewSpecifications` | Factory-owned non-factual editorial view specifications | Immutable versions |
| `timelineEventMemberships` | Ordered event membership and rationale | Immutable edges |
| `lockedEventSets` | Writer input lock | Immutable |
| `writerArtifacts` | Prose and sentence-level claim references | Immutable |
| `proseClaimChecks` | Final allowed-claim comparison | Immutable |
| existing Governance/Library/Published Memory collections | Certified institutional boundary | Existing contracts preserved |
| existing read/search/sitemap collections | Public projections only | Rebuildable projection state |

Edge documents use deterministic IDs from endpoint IDs, predicate, version, and corpus. Frequently queried fields receive composite indexes. Large text and binary source bodies remain index-exempt and archived in Cloud Storage. No document contains unbounded claims, aliases, evidence, memberships, or participants.

## 21. Event reuse

For every new topic:

1. resolve known entities and aliases;
2. query canonical events by entity, temporal range, event subtype, and concept keys;
3. evaluate exact admitted event versions against the new Scope Contract;
4. reuse passing event/claim versions;
5. create Research Map gaps only for missing, weak, disputed, or newly required knowledge.

Reuse does not mean automatic selection. A verified event can be irrelevant or redundant for a particular Timeline View. Timeline-specific significance and context live on membership records; factual event claims remain shared.

## 22. Timeline as a view

The following definition is binding for V2:

> A Timeline is a curated ordered view over admitted Canonical Historical Events.

```ts
type TimelineEventMembership = {
  timelineViewSpecificationId: string;
  canonicalEventVersionId: string;
  ordinal: number;
  scopeContractId: string;
  phaseIds: string[];
  dimensionIds: string[];
  significanceClass: "ESSENTIAL" | "MAJOR" | "SUPPORTING";
  significanceRationale: string;
  timelineContextClaimVersionIds: string[];
  selectionRationale: string;
  immutable: true;
};
```

Membership contains no duplicate event facts. The view specification and membership remain Factory-owned technical artifacts excluded from Governance authority mapping. Governance verifies their referential integrity and that they introduce no authority; an accepted package preserves their exact lineage for reproducible Projection Engine materialization.

The view payload does not enter the Historical Publication Package's canonical authority envelope. The package carries only its immutable artifact reference and hash as lineage metadata. After Historical Library admission, Published Memory preserves that reference; Projection Engine may resolve it only when every referenced event and claim version exactly matches admitted Published Memory. This is a gated technical input, not a second authority path.

## 23. Significance and coverage selection

### 23.1 Candidate pool

Selection begins only after event resolution. A standard topic may have 30–100 verified candidates; the publication view contains no more than 20.

### 23.2 Significance protocol

Each candidate receives evidence-backed findings for:

- consequence;
- turning-point value;
- causal importance;
- institutional importance;
- adoption or scale;
- explanatory value;
- historiographical prominence;
- topic-specific relevance;
- redundancy with stronger candidates.

Source density is a discovery signal, never a significance verdict. V2 does not sum these into an arbitrary universal score.

Selection is lexicographic:

1. remove ineligible, outside-scope, non-event, unresolved-conflict, and below-burden candidates;
2. include essential boundary and turning-point events;
3. satisfy all required phase/dimension coverage cells;
4. add the strongest topic-specific explanatory events;
5. remove redundant events when one explains the same transition at the locked granularity;
6. enforce the count contract and chronology.

Gemini may propose pairwise rankings and rationales. Deterministic software owns eligibility, required-cell coverage, count limits, no duplicate identity, boundary rules, and stable order.

### 23.3 Coverage matrix

The matrix is `Candidate Event x Phase x Dimension` with values:

```text
PRIMARY       event directly represents the cell
SUPPORTING    event contributes but cannot satisfy a required cell alone
NONE          no coverage
```

A coverage gap is unacceptable when:

- a required phase has no PRIMARY selected event;
- a required dimension has no PRIMARY selected event anywhere;
- a Research Map cell marked critical has neither a PRIMARY event nor an explicit non-event resolution;
- a closed episode lacks a defensible opening or terminal event;
- an ongoing subject lacks an event representing its most recent material phase by `ongoingAsOf`;
- coverage is achieved only by duplicative events or evidence below the claim burden.

There are no equal elapsed-time buckets. Sparse periods may be historically correct; every empty required cell must be explained.

## 24. Targeted evidence completion

After provisional selection, deterministic software evaluates the exact core and public-facing claims for each selected event.

For a failing event, completion tasks may seek only:

- a missing claim-authoritative source;
- exact date or temporal precision;
- independent corroboration;
- the original primary record;
- evidence that resolves a dispute;
- an independent secondary interpretation.

The standard budget is two grounded calls and at most twelve provider-reported search queries across the selected set, grouped by authority/source family. Each completion pass creates new snapshots, segments, claim versions, and verdicts; it never mutates old evidence.

Outcomes:

| Outcome | Action |
|---|---|
| `PASS` | Retain the event. |
| `FAIL_REPLACEABLE` | Select the next eligible candidate that preserves required coverage, then evaluate its burden. |
| `FAIL_MATERIAL` | Stop for research escalation or human review; do not hide a missing turning point. |
| `FAIL_SCOPE` | Return to Scope Amendment protocol. |

Replacement is limited to two deterministic substitutions. The Factory may not keep searching until any preferred event passes.

## 25. Locked Event Skeleton

The Locked Event Skeleton is the immutable writer contract.

It includes:

- exact Scope Contract and Research Map versions;
- ordered canonicalized event version IDs;
- allowed core and supporting claim version IDs per event;
- approved temporal display and sort fields;
- approved entity participation and location edges;
- approved evidence verdicts and policy versions;
- membership significance and coverage rationales;
- allowed timeline-level context claim IDs;
- prohibited claims, topics, causal language, and uncertainty elisions;
- count, chronology, coverage, and authority checks;
- a deterministic payload hash.

The writer cannot add, remove, merge, split, reorder, or red-date an event. It cannot add sources or causal assertions.

If a defect is found, the lock is invalidated and a new version is produced from the responsible upstream stage. The existing lock and writer outputs remain immutable.

## 26. Constrained writer

### 26.1 Input

The writer receives only:

- the Locked Event Skeleton;
- human-readable renderings of approved claim versions;
- approved uncertainty qualifiers;
- bounded style and length policy;
- approved event/timeline context claim versions.

It does not receive the broad research corpus, rejected candidates, Wikipedia, or unrestricted search tools.

### 26.2 Output

```ts
type WriterOutput = {
  publicTitle: string;
  summary: SentenceUnit[];
  events: Array<{
    canonicalEventVersionId: string;
    ordinal: number;
    publicTitle: string;
    description: SentenceUnit[];
  }>;
  transitions: SentenceUnit[];
  writerPolicyVersion: string;
  lockId: string;
  payloadHash: string;
};

type SentenceUnit = {
  sentenceId: string;
  text: string;
  claimVersionIds: string[];
  function: "FACTUAL" | "INTERPRETIVE" | "TRANSITION";
};
```

Every factual or interpretive sentence must reference at least one allowed claim version. A transition may have no claim only when it contains no external factual assertion.

Sources are resolved from approved claim-evidence edges. The writer never chooses citations.

## 27. Prose Claim Check

V2 shall extract claims from generated prose and compare them with the lock.

The check has two layers:

1. deterministic validation verifies event identity, order, date strings, numbers, quotations, named entities, claim references, and forbidden terms;
2. a separate model extracts semantic assertions from each sentence and proposes an exact allowed claim mapping.

Deterministic software accepts only mappings to claim IDs already declared by the sentence and lock. Similarity alone cannot authorize a new assertion. Unsupported causation, stronger certainty, changed quantities, changed dates, conflated actors, or additional events fail the artifact.

The writer receives at most two prose-only repair attempts against the same lock. If the lock lacks a necessary claim, the run returns upstream; the writer may not research or amend it.

## 28. Final gates and Governance

### 28.1 Timeline Quality final gate

The final gate verifies:

- exact lock membership and order;
- Scope Contract compliance;
- EVENT-only primary spine;
- date precision and interval-safe chronology;
- required phase/dimension coverage;
- omission semantics;
- count policy;
- redundancy;
- prose claim check;
- no future material;
- no silent scope amendment.

### 28.2 Source Authority final gate

The final Source Authority gate verifies:

- every public assertion resolves to approved claim versions;
- every claim resolves to exact evidence segments and immutable snapshots;
- publisher-prior versions and independence groups are preserved;
- risk burdens pass;
- no prohibited source satisfies burden;
- no material conflict is hidden;
- all artifact hashes and snapshot references match the lock.

### 28.3 Governance package

The immutable Historical Publication Package's canonical authority envelope contains:

- admitted-candidate event/entity/participation versions;
- approved atomic claim versions and evidence lineage;
- Timeline Quality and Source Authority artifacts;
- model, prompt, policy, cost, and audit lineage.

It references, but does not place in its canonical authority mapping:

- the Locked Event Skeleton;
- the non-authoritative Timeline View Specification;
- writer output and prose claim check.

Those immutable Factory technical artifacts are dependencies and lineage, consistent with Editorial Intelligence certification. They acquire no canonical status through package acceptance.

Governance may approve, reject, or request revision. It does not create missing claims, change event facts, or rewrite evidence. Material conflict and `SENSITIVE` claims require human Governance.

## 29. Failure behavior

V2 fails closed with structured reasons:

```text
SCOPE_AMENDMENT_REQUIRED
RESEARCH_MAP_INCOMPLETE
ACQUISITION_BUDGET_EXHAUSTED
SOURCE_IDENTITY_UNRESOLVED
SOURCE_AUTHORITY_INSUFFICIENT
CLAIM_UNSUPPORTED
CLAIM_CONFLICT_UNRESOLVED
ENTITY_IDENTITY_REVIEW_REQUIRED
EVENT_IDENTITY_REVIEW_REQUIRED
COVERAGE_GAP_MATERIAL
EVENT_LIMIT_UNSATISFIABLE
LOCK_INTEGRITY_FAILED
WRITER_CONTRACT_VIOLATION
PROSE_CLAIM_MISMATCH
GOVERNANCE_REVIEW_REQUIRED
```

Every failure records stage, artifact versions, bounded diagnostics, retryability, budget consumption, and recommended owner. Provider transport failure is separate from historical/evidentiary failure. No silent fallback may turn an incomplete artifact into a passing one.

## 30. Security, scale, and operational constraints

- All writes remain server-side and service-account authorized.
- Untrusted source content is data, never instructions; prompt-injection delimiters and schema-constrained outputs remain mandatory.
- URLs are validated, HTTPS-only, redirect-bounded, and protected against private-network/metadata endpoint access before server retrieval.
- Raw HTML, scripts, and active content are never exposed to public clients.
- Source bodies and large model outputs are index-exempt and archived privately.
- Every query is corpus-scoped, indexed, paginated, and bounded. No in-memory corpus scan is allowed.
- Batch writes remain below Firestore limits; high-volume writes use BulkWriter or bounded parallel writes.
- Artifact IDs are content-addressed or UUID-backed and never monotonically allocated on hot write paths.
- Per-topic leases and deterministic task identities preserve at-least-once idempotency.
- Targeted calls expose structured cost, latency, token, query, document, and cache-hit metrics.

## 31. Certification plan before implementation can publish

Implementation is not authorized by this document. A future implementation program must pass these gates in order:

1. **Constitutional reconciliation**: correct the Milestone/Timeline View authority contradictions and register V2 ownership.
2. **Schema contract**: strict TypeScript/Zod schemas, Firestore index plan, size analysis, migration/rollback plan, and emulator tests.
3. **Shadow acquisition**: run without Governance submission or publication against preserved fixtures for Web, Berlin Wall, Apollo 11, Cuban Missile Crisis, and Apollo 13.
4. **Claim certification**: prove claim atomicity, exact evidence spans, source independence, Wikipedia exclusion, conflict handling, and no pseudo-confidence.
5. **Event certification**: prove reuse, identity, merge/split, same-day distinction, long-running events, uncertainty, and EVENT-only selection.
6. **Selection certification**: prove subject-derived phase/dimension coverage, 20-event maximum, low-count exception, omission handling, and deterministic replay.
7. **Writer certification**: prove exact lock preservation and zero unsupported prose claims across heterogeneous topics.
8. **Institutional compatibility**: prove Governance, Historical Library, Published Memory, Projection, Search, APIs, and public rendering are byte-compatible where contracts are unchanged.
9. **Load/cost certification**: demonstrate bounded p95 latency, Firestore index behavior, worker concurrency, source caching, and budget enforcement.
10. **Explicit live authorization**: only after all offline gates pass may a new non-legacy production certification request be authorized.

No replay of existing review items, Published Memory mutation, autonomous discovery resumption, deployment, or production publication is authorized by this design.

## 32. Acceptance invariants

V2 is correctly implemented only if all are true:

- The same topic and same admitted knowledge produce the same event lock hash under the same policy versions.
- No writer sentence contains a factual assertion outside approved claims.
- No claim evidence lacks an exact immutable segment and source snapshot.
- No source count substitutes for relevance, independence, or risk.
- No model can mutate scope after it is locked.
- No STATE_LEGACY, CONTEXT, or FUTURE item appears on the primary spine.
- No coarse date is converted to a fabricated precise sort key.
- No Timeline View duplicates canonical event facts.
- No entry origin changes historical methodology.
- No Factory artifact bypasses Governance or Historical Library.
- No downstream projection recreates authority.
- No published version is deleted or rewritten.

## 33. Input limitation

The design brief supplied for this goal ends mid-sentence in section 33 after `compare them against allowed claim`. This architecture includes the implied prose-claim comparison requirement, but it does not invent any unseen requirements beyond the supplied text. If a complete brief exists, it must be reconciled with this lock before implementation begins.

## 34. Final verdict

**ARCHITECTURE DECISION: ACCEPT EVIDENCE-FIRST FACTORY V2 WITH SCOPE-FIRST AND SELECTION-SEPARATION QUALIFICATIONS.**

The new Factory is not `evidence -> prose`. It is:

```text
scope-controlled inquiry
  -> durable sources
    -> atomic verified claims
      -> resolved reusable events
        -> significance/coverage selection
          -> immutable event lock
            -> constrained prose
```

This ordering addresses every observed live failure at the earliest responsible stage while preserving the certified institutional publication path.

## Appendix A. Repository authority and implementation basis reviewed

This lock was derived from the current repository, with implementation and certification evidence taking precedence over stale summaries:

- `Knowledge/AUTHORITY_INDEX.md` and `Knowledge/01_PRODUCT_CONSTITUTION_V2.md` through `Knowledge/07_PLATFORM_STATUS_AND_ROADMAP.md`;
- `PROJECT_SOURCES/07_PLATFORM_STATUS.md`, `08_MASTER_EXECUTION_ROADMAP.md`, and `09_CURRENT_EXECUTION.md`;
- `docs/architecture/INSTITUTIONAL_ARCHITECTURE.md`, `PUBLICATION_CONSTITUTION.md`, `DOMAIN_MODEL.md`, and `PLATFORM_CAPABILITIES.md`;
- `docs/constitution/HISTORICAL_OBJECT_CONSTITUTION.md` and `HISTORICAL_LIBRARY_CONSTITUTION.md`;
- all current `docs/factory/*` authority documents;
- Source Authority root policy, V2 migration/certification records, governance source/claim/provenance/dispute policies, and `functions/src/source-authority.ts`;
- Timeline Quality root policy, V1/V2/V3 migration records, chronology authority, `functions/src/quality.ts`, and `functions/src/schemas.ts`;
- Editorial Intelligence certification and foundational institutional certification;
- clean-corpus reset and serverless migration records;
- active Firestore corpus access, pipeline, Topic Ledger, Cloud Tasks, Vertex grounding, public API, and index contracts in `functions/src/*`, `firebase.json`, and `firestore.indexes.json`;
- current graph, claim, source, event, timeline, relationship, and revision design authorities.

Legacy PostgreSQL-era summaries under `docs/authority`, `docs/data`, `docs/governance`, and `docs/graph` were treated as historical/design evidence where current Firestore implementation and 2026-09 certification records supersede their `Current Reality` sections.
