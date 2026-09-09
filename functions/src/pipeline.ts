import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firestore";
import {
  ACTIVE_CORPUS_ID,
  PUBLIC_ID_BASE,
  GOVERNANCE_POLICY_VERSION,
  LEASE_DURATION_MS,
  MAX_TOPIC_ATTEMPTS,
  PIPELINE_VERSION,
  QUALITY_POLICY_VERSION,
  SCHEMA_VERSION
} from "./config";
import { assertActiveCorpus, corpusCollection, corpusRecord, requireTaskCorpus, type CorpusCollectionName } from "./corpus";
import { hashValue, slugifyTopic } from "./normalization";
import type { GeneratedTimeline, SourceCandidate, TaskPayload } from "./schemas";
import { generatedTimelineSchema, sourceCandidateSchema, timelineEditorialPlanSchema } from "./schemas";
import { groundedEvidenceSegmentSchema } from "./schemas";
import { enqueueInstitutionalTask } from "./tasks";
import { assessEditorialPlan, assessTimelineQuality, selectV3Chronology, upgradeLegacyPlanForV3, type TimelineQualityAssessment } from "./quality";
import { assessReaderEditorialReview, READER_EDITORIAL_POLICY_VERSION, type ReaderEditorialAssessment } from "./editorial-reader";
import {
  assessSourceAuthority,
  selectAuthoritativeEvidence,
  SOURCE_AUTHORITY_POLICY_VERSION,
  type SourceAuthorityAssessment
} from "./source-authority";
import {
  generateEditorialPlan,
  generateReaderEditorialReview,
  generateStructuredTimeline,
  mergeResearchResults,
  researchAuthorityGaps,
  researchTopic,
  type EditorialPlanResult,
  type GenerationResult,
  type ResearchResult
} from "./vertex";

type LeaseResult = { acquired: true; displayTitle: string; normalizedTitle: string; attemptCount: number } | { acquired: false; reason: string };

function applyAuthorityEvidenceSelection(generation: GenerationResult, research: ResearchResult): GenerationResult {
  return { ...generation, timeline: selectAuthoritativeEvidence({ timeline: generation.timeline, sources: research.sources, evidenceSegments: research.evidenceSegments }) };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function persistReaderEditorialArtifact(
  payload: TaskPayload,
  assessment: ReaderEditorialAssessment,
  execution: import("./vertex").VertexExecutionMetadata,
  timelineObjectId: string
) {
  const artifactPayload = { ...assessment, candidateRef: timelineObjectId };
  const artifactId = authorityId(payload.jobId, "reader-editorial", READER_EDITORIAL_POLICY_VERSION, hashValue(stableJson(artifactPayload)));
  await createIfAbsent("qualityArtifacts", artifactId, {
    qualityArtifactId: artifactId,
    runId: payload.jobId,
    topicId: payload.topicId,
    objectRef: timelineObjectId,
    artifactType: "reader_editorial_assessment",
    policyVersion: READER_EDITORIAL_POLICY_VERSION,
    payload: artifactPayload,
    payloadHash: hashValue(stableJson(artifactPayload)),
    modelProvenance: execution,
    immutable: true,
    createdAt: Timestamp.now()
  });
  return artifactId;
}

function authorityId(...parts: string[]) {
  return hashValue(parts.join(":" )).slice(0, 40);
}

function deterministicUuid(...parts: string[]) {
  const value = hashValue(parts.join(":" )).slice(0, 32).split("");
  value[12] = "5";
  value[16] = ((Number.parseInt(value[16]!, 16) & 0x3) | 0x8).toString(16);
  const hex = value.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function createIfAbsent(collection: CorpusCollectionName, id: string, data: Record<string, unknown>) {
  const ref = corpusCollection(collection).doc(id);
  try {
    await ref.create(corpusRecord(data));
    return true;
  } catch (error) {
    const code = (error as { code?: number | string }).code;
    if (code === 6 || code === "already-exists") return false;
    throw error;
  }
}

async function acquireLease(payload: TaskPayload, leaseOwner: string): Promise<LeaseResult> {
  const ledgerRef = corpusCollection("topicLedgers").doc(payload.topicId);
  const jobRef = corpusCollection("generationJobs").doc(payload.jobId);
  return db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(ledgerRef, jobRef);
    const ledger = snapshots[0]!;
    const job = snapshots[1]!;
    if (!ledger.exists || !job.exists) return { acquired: false, reason: "missing_topic_or_job" };
    const data = ledger.data()!;
    if (data.generation !== payload.generation || data.activeJobId !== payload.jobId) {
      return { acquired: false, reason: "stale_generation" };
    }
    if (data.state === "PUBLISHED" || data.state === "CANCELLED") {
      return { acquired: false, reason: data.state.toLocaleLowerCase("en-US") };
    }
    const leaseExpiresAt = data.leaseExpiresAt instanceof Timestamp ? data.leaseExpiresAt.toMillis() : 0;
    if (data.state === "PROCESSING" && leaseExpiresAt > Date.now() && data.leaseOwner !== leaseOwner) {
      return { acquired: false, reason: "active_lease" };
    }
    const attemptCount = Number(data.attemptCount || 0) + 1;
    if (attemptCount > Number(data.maximumAttempts || MAX_TOPIC_ATTEMPTS)) {
      transaction.update(ledgerRef, { state: "FAILED", currentStage: "terminal", leaseOwner: null, leaseExpiresAt: null, updatedAt: Timestamp.now() });
      transaction.update(jobRef, { state: "FAILED", currentStage: "terminal", updatedAt: Timestamp.now() });
      return { acquired: false, reason: "attempts_exhausted" };
    }
    const now = Timestamp.now();
    const lease = Timestamp.fromMillis(Date.now() + LEASE_DURATION_MS);
    transaction.update(ledgerRef, {
      state: "PROCESSING",
      currentStage: "factory_research",
      leaseOwner,
      leaseExpiresAt: lease,
      attemptCount,
      lastError: null,
      updatedAt: now
    });
    transaction.update(jobRef, {
      state: "PROCESSING",
      currentStage: "factory_research",
      leaseOwner,
      leaseExpiresAt: lease,
      attemptCount,
      startedAt: job.data()?.startedAt || now,
      updatedAt: now
    });
    return {
      acquired: true,
      displayTitle: String(data.displayTitle),
      normalizedTitle: String(data.normalizedTitle),
      attemptCount
    };
  });
}

async function setStage(payload: TaskPayload, stage: string) {
  const now = Timestamp.now();
  const lease = Timestamp.fromMillis(Date.now() + LEASE_DURATION_MS);
  await db.runTransaction(async (transaction) => {
    const ledgerRef = corpusCollection("topicLedgers").doc(payload.topicId);
    const ledger = await transaction.get(ledgerRef);
    if (!ledger.exists || ledger.data()?.activeJobId !== payload.jobId || ledger.data()?.generation !== payload.generation) {
      throw new Error("Topic ledger ownership changed during execution.");
    }
    transaction.update(ledgerRef, { currentStage: stage, leaseExpiresAt: lease, updatedAt: now });
    transaction.update(corpusCollection("generationJobs").doc(payload.jobId), { currentStage: stage, leaseExpiresAt: lease, updatedAt: now });
  });
}

async function persistResearch(payload: TaskPayload, research: ResearchResult) {
  const runId = payload.jobId;
  await createIfAbsent("factoryRuns", runId, {
    runId,
    topicId: payload.topicId,
    jobId: payload.jobId,
    generation: payload.generation,
    pipelineVersion: PIPELINE_VERSION,
    modelProvenance: research.execution,
    researchMetrics: research.researchMetrics,
    state: "RESEARCH_COMPLETED",
    createdAt: Timestamp.now()
  });
  const snapshotId = authorityId(payload.jobId, "grounded-research", research.execution.responseHash);
  const corpusDocumentId = authorityId(snapshotId, "research-corpus");
  await createIfAbsent("sourceSnapshots", snapshotId, {
    snapshotId,
    topicId: payload.topicId,
    jobId: payload.jobId,
    acquisitionMechanism: "google_search_grounding",
    body: research.body,
    contentHash: research.execution.responseHash,
    retrievedAt: research.sources[0]?.retrievedAt || new Date().toISOString(),
    groundingMetadata: research.groundingMetadata,
    sources: research.sources,
    evidenceSegments: research.evidenceSegments,
    modelProvenance: research.execution,
    researchMetrics: research.researchMetrics,
    immutable: true,
    createdAt: Timestamp.now()
  });
  await createIfAbsent("corpusDocuments", corpusDocumentId, {
    corpusDocumentId,
    topicId: payload.topicId,
    jobId: payload.jobId,
    sourceSnapshotId: snapshotId,
    content: research.body,
    contentHash: research.execution.responseHash,
    sourceRefs: research.sources.map((source) => authorityId("source", source.url)),
    evidenceSegments: research.evidenceSegments,
    immutable: true,
    createdAt: Timestamp.now()
  });
  const batch = db.batch();
  for (const source of research.sources) {
    const sourceId = authorityId("source", source.url);
    batch.set(corpusCollection("sourceRecords").doc(sourceId), {
      sourceId,
      canonicalUrl: source.url,
      title: source.title,
      publisher: source.publisher,
      publisherOrigin: source.publisherOrigin,
      latestSnapshotId: snapshotId,
      retrievedAt: source.retrievedAt,
      updatedAt: Timestamp.now()
    }, { merge: true });
  }
  await batch.commit();
  const researchArtifactId = authorityId(payload.jobId, "research-artifact", snapshotId);
  await createIfAbsent("factoryArtifacts", researchArtifactId, {
    artifactId: researchArtifactId,
    runId,
    topicId: payload.topicId,
    artifactType: "grounded_research",
    sourceSnapshotId: snapshotId,
    sourceRefs: research.sources.map((source) => authorityId("source", source.url)),
    contentHash: research.execution.responseHash,
    payload: { execution: research.execution, groundingMetadata: research.groundingMetadata, researchMetrics: research.researchMetrics },
    immutable: true,
    createdAt: Timestamp.now()
  });
  return snapshotId;
}

async function loadResearchSnapshot(sourceSnapshotId: string): Promise<ResearchResult> {
  const snapshot = await corpusCollection("sourceSnapshots").doc(sourceSnapshotId).get();
  if (!snapshot.exists) throw new Error("Exact Source Authority research snapshot is missing.");
  const data = snapshot.data()!;
  return {
    body: String(data.body || ""),
    sources: Array.isArray(data.sources) ? data.sources.map((source: unknown) => sourceCandidateSchema.parse(source)) : [],
    evidenceSegments: Array.isArray(data.evidenceSegments) ? data.evidenceSegments.map((segment: unknown) => groundedEvidenceSegmentSchema.parse(segment)) : [],
    groundingMetadata: data.groundingMetadata || {},
    execution: data.modelProvenance as ResearchResult["execution"],
    researchMetrics: data.researchMetrics || { groundedSearchCallCount: 1, additionalVertexCallCount: 0, repairCallCount: 0 }
  };
}

async function resolveCandidateResearchSnapshot(topicId: string, jobId: string, candidate: FirebaseFirestore.DocumentData) {
  const directRef = typeof candidate.sourceSnapshotId === "string" ? candidate.sourceSnapshotId : null;
  if (directRef) return { sourceSnapshotId: directRef, research: await loadResearchSnapshot(directRef) };
  const evidence = await corpusCollection("evidenceRecords").where("topicId", "==", topicId).limit(500).get();
  const references = new Set(evidence.docs
    .filter((document) => !document.data().jobId || document.data().jobId === jobId)
    .map((document) => document.data().sourceSnapshotId)
    .filter((value): value is string => typeof value === "string" && value.length > 0));
  if (references.size !== 1) throw new Error("Legacy candidate research lineage is missing or ambiguous; routine publication fails closed.");
  const sourceSnapshotId = [...references][0]!;
  return { sourceSnapshotId, research: await loadResearchSnapshot(sourceSnapshotId) };
}

async function persistFactoryCandidate(payload: TaskPayload, research: ResearchResult, generation: GenerationResult, sourceSnapshotId: string) {
  const timeline = generatedTimelineSchema.parse(generation.timeline);
  const sourceMap = new Map(research.sources.map((source) => [source.sourceId, source]));
  const evidenceMap = new Map(research.evidenceSegments.map((segment) => [segment.evidenceRef, segment]));
  const timelineObjectId = authorityId(payload.jobId, "timeline-candidate");
  const existing = await corpusCollection("factoryObjects").doc(timelineObjectId).get();
  if (existing.exists) {
    const resolved = await resolveCandidateResearchSnapshot(payload.topicId, payload.jobId, existing.data()!);
    return {
      timelineObjectId,
      timeline: generatedTimelineSchema.parse(existing.data()!.payload),
      sourceSnapshotId: resolved.sourceSnapshotId
    };
  }
  const batch = db.batch();
  batch.create(corpusCollection("factoryObjects").doc(timelineObjectId), {
    objectId: timelineObjectId,
    runId: payload.jobId,
    topicId: payload.topicId,
    objectType: "candidate_timeline",
    schemaVersion: SCHEMA_VERSION,
    payload: timeline,
    payloadHash: hashValue(stableJson(timeline)),
    sourceSnapshotId,
    modelProvenance: generation.execution,
    authorityState: "FACTORY_CANDIDATE",
    immutable: true,
    createdAt: Timestamp.now()
  });
  timeline.events.forEach((event, eventIndex) => {
    const eventObjectId = authorityId(payload.jobId, "event", String(eventIndex));
    batch.create(corpusCollection("factoryObjects").doc(eventObjectId), {
      objectId: eventObjectId,
      runId: payload.jobId,
      topicId: payload.topicId,
      parentObjectId: timelineObjectId,
      objectType: "candidate_milestone",
      payload: event,
      payloadHash: hashValue(stableJson(event)),
      sourceSnapshotId,
      authorityState: "FACTORY_CANDIDATE",
      immutable: true,
      createdAt: Timestamp.now()
    });
    event.evidenceRefs.forEach((evidenceRef) => {
      const segment = evidenceMap.get(evidenceRef);
      if (!segment) throw new Error(`Candidate references unavailable evidence ${evidenceRef}.`);
      const sources = segment.sourceRefs.map((sourceRef) => sourceMap.get(sourceRef));
      if (sources.some((source) => !source)) throw new Error(`Evidence ${evidenceRef} references an unavailable source.`);
      const sourceIds = sources.map((source) => authorityId("source", source!.url));
      const evidenceId = authorityId(payload.jobId, "evidence", String(eventIndex), evidenceRef);
      const validationId = authorityId(evidenceId, GOVERNANCE_POLICY_VERSION);
      const corpusDocumentId = authorityId(sourceSnapshotId, "research-corpus");
      batch.create(corpusCollection("evidenceRecords").doc(evidenceId), {
        evidenceId,
        topicId: payload.topicId,
        jobId: payload.jobId,
        sourceId: sourceIds[0],
        sourceIds,
        claim: event.description,
        fieldPath: `events.${eventIndex}.description`,
        exactEvidence: segment.exactEvidence,
        evidenceSummary: event.evidenceSummary,
        groundingSegment: { evidenceRef, startIndex: segment.startIndex, endIndex: segment.endIndex },
        sourceSnapshotId,
        corpusDocumentId,
        sourceSnapshotHash: research.execution.responseHash,
        acquisitionMechanism: "google_search_grounding",
        immutable: true,
        createdAt: Timestamp.now()
      });
      batch.create(corpusCollection("evidenceValidations").doc(validationId), {
        validationId,
        evidenceId,
        policyVersion: GOVERNANCE_POLICY_VERSION,
        result: "PASSED",
        checks: { sourceResolved: true, snapshotResolved: true, corpusResolved: true, groundedAcquisition: true, topicAligned: true, claimLinked: true },
        immutable: true,
        createdAt: Timestamp.now()
      });
      batch.create(corpusCollection("claimLinks").doc(authorityId(payload.jobId, "claim-link", String(eventIndex), evidenceRef)), {
        topicId: payload.topicId,
        factoryObjectId: eventObjectId,
        evidenceId,
        validationId,
        sourceIds,
        claimPath: `events.${eventIndex}.description`,
        immutable: true,
        createdAt: Timestamp.now()
      });
    });
  });
  batch.create(corpusCollection("factoryArtifacts").doc(authorityId(payload.jobId, "structured-generation")), {
    artifactId: authorityId(payload.jobId, "structured-generation"),
    runId: payload.jobId,
    topicId: payload.topicId,
    artifactType: "editorial_timeline_candidate",
    objectRef: timelineObjectId,
    payload: { execution: generation.execution },
    contentHash: generation.execution.responseHash,
    immutable: true,
    createdAt: Timestamp.now()
  });
  await batch.commit();
  return { timelineObjectId, timeline, sourceSnapshotId };
}

async function persistQualityArtifact(
  payload: TaskPayload,
  planResult: EditorialPlanResult,
  assessment: TimelineQualityAssessment,
  timelineObjectId: string
) {
  const qualityArtifactId = authorityId(payload.jobId, "timeline-quality", QUALITY_POLICY_VERSION);
  const payloadValue = {
    scopeAssessment: planResult.plan.scope,
    temporalBoundaries: {
      startBoundary: planResult.plan.scope.startBoundary,
      startYear: planResult.plan.scope.startYear,
      endBoundary: planResult.plan.scope.endBoundary,
      endYear: planResult.plan.scope.endYear,
      isOngoing: planResult.plan.scope.isOngoing
    },
    eraMap: planResult.plan.scope.majorEras,
    candidateEventInventory: planResult.plan.candidates,
    selectedCandidateIds: planResult.plan.candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.candidateId),
    rejectedCandidates: planResult.plan.candidates.filter((candidate) => !candidate.selected).map((candidate) => ({ candidateId: candidate.candidateId, reason: candidate.rejectionReason })),
    coverageAssessment: { eraDistribution: assessment.eraDistribution, eventDistribution: assessment.eventDistribution, checks: { eraCoverage: assessment.checks.eraCoverage, temporalBalance: assessment.checks.temporalBalance, endpointCoverage: assessment.checks.endpointCoverage } },
    redundancyAssessment: { review: planResult.plan.redundancyReview, result: assessment.checks.redundancy },
    omissionAssessment: { review: planResult.plan.omissionReview, classifications: assessment.omissionAssessments, result: assessment.checks.omissions },
    eventSemanticAssessment: {
      selectedEvents: planResult.plan.candidates.filter((candidate) => candidate.selected).map((candidate) => ({ candidateId: candidate.candidateId, semanticType: candidate.semanticType })),
      excludedItems: planResult.plan.candidates.filter((candidate) => !candidate.selected).map((candidate) => ({ candidateId: candidate.candidateId, semanticType: candidate.semanticType, reason: candidate.rejectionReason })),
      result: assessment.checks.eventSemantics
    },
    datePrecisionAssessment: { result: assessment.checks.datePrecision },
    finalQualityVerdict: assessment.verdict,
    unresolvedReasons: assessment.unresolvedReasons,
    qualityPolicyVersion: assessment.policyVersion
  };
  await createIfAbsent("qualityArtifacts", qualityArtifactId, {
    qualityArtifactId,
    runId: payload.jobId,
    topicId: payload.topicId,
    objectRef: timelineObjectId,
    artifactType: "timeline_quality_assessment",
    payload: payloadValue,
    payloadHash: hashValue(stableJson(payloadValue)),
    modelProvenance: planResult.execution,
    immutable: true,
    createdAt: Timestamp.now()
  });
  await createIfAbsent("factoryArtifacts", authorityId(payload.jobId, "timeline-quality-artifact"), {
    artifactId: authorityId(payload.jobId, "timeline-quality-artifact"),
    runId: payload.jobId,
    topicId: payload.topicId,
    artifactType: "timeline_quality_assessment",
    objectRef: timelineObjectId,
    qualityArtifactRef: qualityArtifactId,
    policyVersion: QUALITY_POLICY_VERSION,
    contentHash: hashValue(stableJson(payloadValue)),
    immutable: true,
    createdAt: Timestamp.now()
  });
  return qualityArtifactId;
}

async function persistSourceAuthorityArtifact(
  payload: TaskPayload,
  timelineObjectId: string,
  sourceSnapshotId: string,
  assessment: SourceAuthorityAssessment,
  research: ResearchResult
) {
  const sourceAuthorityArtifactId = authorityId(payload.jobId, "source-authority", SOURCE_AUTHORITY_POLICY_VERSION);
  const artifactPayload = {
    policyVersion: assessment.policyVersion,
    sourceSnapshotRef: sourceSnapshotId,
    sourceInventory: assessment.sourceInventory,
    claims: assessment.claims,
    sourceDiversity: assessment.sourceDiversity,
    conflictFindings: assessment.conflictFindings,
    unresolvedSourceIssues: assessment.unresolvedSourceIssues,
    policyLimitations: assessment.policyLimitations,
    overallVerdict: assessment.overallVerdict,
    researchCost: {
      groundedSearchCallCount: research.researchMetrics.groundedSearchCallCount,
      sourcesEvaluated: research.sources.length,
      additionalVertexCallCount: research.researchMetrics.additionalVertexCallCount,
      repairCallCount: research.researchMetrics.repairCallCount,
      usageMetadata: research.execution.usageMetadata
    }
  };
  await createIfAbsent("sourceAuthorityArtifacts", sourceAuthorityArtifactId, {
    sourceAuthorityArtifactId,
    runId: payload.jobId,
    topicId: payload.topicId,
    objectRef: timelineObjectId,
    sourceSnapshotRef: sourceSnapshotId,
    artifactType: "source_authority_v2_assessment",
    policyVersion: SOURCE_AUTHORITY_POLICY_VERSION,
    payload: artifactPayload,
    payloadHash: hashValue(stableJson(artifactPayload)),
    deterministic: true,
    immutable: true,
    createdAt: Timestamp.now()
  });
  await createIfAbsent("factoryArtifacts", authorityId(payload.jobId, "source-authority-artifact", SOURCE_AUTHORITY_POLICY_VERSION), {
    artifactId: authorityId(payload.jobId, "source-authority-artifact", SOURCE_AUTHORITY_POLICY_VERSION),
    runId: payload.jobId,
    topicId: payload.topicId,
    artifactType: "source_authority_v2_assessment",
    objectRef: timelineObjectId,
    sourceAuthorityArtifactRef: sourceAuthorityArtifactId,
    sourceSnapshotRef: sourceSnapshotId,
    policyVersion: SOURCE_AUTHORITY_POLICY_VERSION,
    contentHash: hashValue(stableJson(artifactPayload)),
    immutable: true,
    createdAt: Timestamp.now()
  });
  return sourceAuthorityArtifactId;
}

export function evaluateRoutinePolicy(
  timeline: GeneratedTimeline,
  sources: SourceCandidate[],
  quality: TimelineQualityAssessment,
  sourceAuthority?: SourceAuthorityAssessment,
  readerEditorial?: ReaderEditorialAssessment
) {
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  const reasons: string[] = [];
  if (sources.length < 2) reasons.push("fewer_than_two_grounded_sources");
  if (timeline.events.some((event) => event.sourceRefs.length === 0)) reasons.push("milestone_without_evidence");
  if (timeline.events.some((event) => event.sourceRefs.some((sourceRef) => !sourceIds.has(sourceRef)))) reasons.push("unresolved_source_reference");
  if (new Set(timeline.events.map((event) => `${event.sortYear}:${event.sortMonth}:${event.sortDay}:${event.title.toLocaleLowerCase("en-US")}`)).size !== timeline.events.length) {
    reasons.push("duplicate_milestone_signature");
  }
  if (quality.verdict !== "passed") reasons.push(...quality.unresolvedReasons.map((reason) => `timeline_quality:${reason}`));
  if (!readerEditorial) reasons.push("reader_editorial:missing_assessment");
  else if (readerEditorial.verdict !== "passed") reasons.push(...readerEditorial.unresolvedReasons);
  if (!sourceAuthority) reasons.push("source_authority:missing_v2_assessment");
  else if (sourceAuthority.overallVerdict !== "passed") {
    reasons.push(`source_authority:${sourceAuthority.overallVerdict}`);
    reasons.push(...sourceAuthority.unresolvedSourceIssues.map((reason) => `source_authority:${reason}`));
    reasons.push(...sourceAuthority.conflictFindings.map((reason) => `source_authority_conflict:${reason}`));
  }
  return reasons.length === 0
    ? { outcome: "routine" as const, reasons: ["Timeline Quality, reader-level editorial quality, claim-level Source Authority, evidence lineage, chronology, and duplicate gates passed."] }
    : { outcome: "exceptional" as const, reasons };
}

export function sourceAuthorityPublicationDefects(input: {
  topicId: string;
  jobId: string;
  timelineObjectId: string;
  sourceSnapshotId: string;
  timeline: GeneratedTimeline;
  artifact: FirebaseFirestore.DocumentData;
}): string[] {
  const defects: string[] = [];
  const { artifact } = input;
  const assessment = artifact.payload as (SourceAuthorityAssessment & { sourceSnapshotRef?: string }) | undefined;
  if (artifact.topicId !== input.topicId || artifact.runId !== input.jobId || artifact.objectRef !== input.timelineObjectId) {
    defects.push("Source Authority artifact ownership does not match the candidate generation.");
  }
  if (artifact.sourceSnapshotRef !== input.sourceSnapshotId || assessment?.sourceSnapshotRef !== input.sourceSnapshotId) {
    defects.push("Source Authority artifact snapshot lineage does not match the candidate.");
  }
  if (artifact.policyVersion !== SOURCE_AUTHORITY_POLICY_VERSION || assessment?.policyVersion !== SOURCE_AUTHORITY_POLICY_VERSION) {
    defects.push("Source Authority artifact policy version is stale.");
  }
  if (!assessment || artifact.payloadHash !== hashValue(stableJson(assessment))) defects.push("Source Authority artifact payload integrity check failed.");
  if (!assessment || assessment.overallVerdict !== "passed" || assessment.unresolvedSourceIssues.length > 0 || assessment.conflictFindings.length > 0) {
    defects.push("Source Authority artifact is not a clean passing verdict.");
  }
  if (!assessment || assessment.claims.length !== input.timeline.events.length) {
    defects.push("Source Authority claim inventory does not cover every candidate event.");
  } else {
    input.timeline.events.forEach((event, eventIndex) => {
      const claim = assessment.claims[eventIndex];
      const assessedEvidenceRefs = new Set(claim?.evidence.map((evidence) => evidence.evidenceRef) || []);
      const assessedSourceRefs = new Set(claim?.evidence.map((evidence) => evidence.sourceRef) || []);
      if (!claim || claim.eventIndex !== eventIndex || claim.eventTitle !== event.title || claim.verdict !== "passed" ||
        claim.unresolvedIssues.length > 0 || claim.conflictFindings.length > 0) {
        defects.push(`Source Authority claim ${eventIndex + 1} is missing, stale, or non-passing.`);
      }
      if (event.evidenceRefs.some((evidenceRef) => !assessedEvidenceRefs.has(evidenceRef)) ||
        event.sourceRefs.some((sourceRef) => !assessedSourceRefs.has(sourceRef))) {
        defects.push(`Source Authority claim ${eventIndex + 1} does not cover the candidate evidence lineage.`);
      }
    });
  }
  return defects;
}

async function createGovernancePackage(
  payload: TaskPayload,
  timelineObjectId: string,
  timeline: GeneratedTimeline,
  sources: SourceCandidate[],
  quality: TimelineQualityAssessment,
  qualityArtifactId: string,
  sourceAuthority: SourceAuthorityAssessment,
  sourceAuthorityArtifactId: string,
  sourceSnapshotId: string,
  readerEditorial?: ReaderEditorialAssessment,
  readerEditorialArtifactId?: string
) {
  const packageId = deterministicUuid(payload.jobId, "governance-package", GOVERNANCE_POLICY_VERSION);
  const queueId = authorityId(packageId, "publication-readiness-queue");
  const policy = evaluateRoutinePolicy(timeline, sources, quality, sourceAuthority, readerEditorial);
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const ledgerRef = corpusCollection("topicLedgers").doc(payload.topicId);
    const packageRef = corpusCollection("governancePackages").doc(packageId);
    const snapshots = await transaction.getAll(ledgerRef, packageRef);
    const ledger = snapshots[0]!;
    const existingPackage = snapshots[1]!;
    if (ledger.data()?.activeJobId !== payload.jobId || ledger.data()?.generation !== payload.generation) throw new Error("Stale generation before Governance handoff.");
    if (!existingPackage.exists) {
      transaction.create(packageRef, {
        packageId,
        topicId: payload.topicId,
        jobId: payload.jobId,
        generation: payload.generation,
        origin: payload.origin,
        factoryObjectRefs: [timelineObjectId],
        qualityArtifactRef: qualityArtifactId,
        sourceAuthorityArtifactRef: sourceAuthorityArtifactId,
        sourceSnapshotRef: sourceSnapshotId,
        sourceAuthorityPolicyVersion: SOURCE_AUTHORITY_POLICY_VERSION,
        sourceAuthorityVerdict: sourceAuthority.overallVerdict,
        qualityPolicyVersion: quality.policyVersion,
        qualityVerdict: quality.verdict,
        readerEditorialArtifactRef: readerEditorialArtifactId ?? null,
        readerEditorialPolicyVersion: readerEditorial?.policyVersion ?? null,
        readerEditorialVerdict: readerEditorial?.verdict ?? "failed",
        evidenceQuery: { topicId: payload.topicId, validationResult: "PASSED" },
        policyVersion: GOVERNANCE_POLICY_VERSION,
        policyEvaluation: policy,
        lifecycle: policy.outcome === "routine" ? "GOVERNANCE_READY" : "AWAITING_REVIEW",
        immutable: true,
        createdAt: now
      });
    }
    if (policy.outcome === "exceptional") {
      if (!existingPackage.exists) {
        transaction.create(corpusCollection("governanceQueues").doc(queueId), {
          queueId,
          queueType: "publication_readiness",
          targetPackageId: packageId,
          topicId: payload.topicId,
          origin: payload.origin,
          allowedActions: ["approve", "reject", "request_revision", "escalate"],
          lifecycle: "ENTERED",
          reasons: policy.reasons,
          createdAt: now
        });
      }
      transaction.update(ledgerRef, { state: "AWAITING_REVIEW", currentStage: "governance_review", leaseOwner: null, leaseExpiresAt: null, updatedAt: now });
      transaction.update(corpusCollection("generationJobs").doc(payload.jobId), { state: "AWAITING_REVIEW", currentStage: "governance_review", updatedAt: now });
    } else {
      transaction.update(ledgerRef, { currentStage: "governance", updatedAt: now });
      transaction.update(corpusCollection("generationJobs").doc(payload.jobId), { currentStage: "governance", packageId, updatedAt: now });
    }
  });
  return { packageId, policy };
}

export async function executeGeneration(payload: TaskPayload, leaseOwner: string) {
  requireTaskCorpus(payload.corpusId);
  const lease = await acquireLease(payload, leaseOwner);
  if (!lease.acquired) return { status: "NO_OP", reason: lease.reason };
  try {
    let research = await researchTopic(lease.displayTitle);
    let sourceSnapshotId = await persistResearch(payload, research);
    await setStage(payload, "editorial_scope_planning");
    let planResult = await generateEditorialPlan(lease.displayTitle, research);
    let planReasons = assessEditorialPlan({ plan: planResult.plan, allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)), allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef)) });
    for (let planRepair = 1; planReasons.length > 0 && planRepair <= 2; planRepair += 1) {
      await setStage(payload, `editorial_plan_repair_${planRepair}`);
      planResult = await generateEditorialPlan(lease.displayTitle, research, planReasons.join("\n"), planResult.plan.scope);
      planReasons = assessEditorialPlan({ plan: planResult.plan, allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)), allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef)) });
    }
    await setStage(payload, "editorial_intelligence");
    let generation = applyAuthorityEvidenceSelection(await generateStructuredTimeline(lease.displayTitle, research, planResult.plan), research);
    let assessment = assessTimelineQuality({
      plan: planResult.plan,
      timeline: generation.timeline,
      allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)),
      allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef))
    });
    for (let editorialRepair = 1; assessment.verdict === "failed" && editorialRepair <= 2; editorialRepair += 1) {
      await setStage(payload, `editorial_quality_repair_${editorialRepair}`);
      planResult = await generateEditorialPlan(lease.displayTitle, research, assessment.unresolvedReasons.join("\n"), planResult.plan.scope);
      generation = applyAuthorityEvidenceSelection(await generateStructuredTimeline(lease.displayTitle, research, planResult.plan), research);
      assessment = assessTimelineQuality({
        plan: planResult.plan,
        timeline: generation.timeline,
        allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)),
        allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef))
      });
    }
    let preliminaryAuthority = assessSourceAuthority({ timeline: generation.timeline, sources: research.sources, evidenceSegments: research.evidenceSegments });
    if (assessment.verdict === "passed" && preliminaryAuthority.overallVerdict !== "passed") {
      await setStage(payload, "source_authority_research_repair");
      const supplemental = await researchAuthorityGaps(lease.displayTitle, generation.timeline, [
        ...preliminaryAuthority.unresolvedSourceIssues,
        ...preliminaryAuthority.conflictFindings
      ]);
      research = mergeResearchResults(research, supplemental);
      sourceSnapshotId = await persistResearch(payload, research);
      generation = applyAuthorityEvidenceSelection(await generateStructuredTimeline(lease.displayTitle, research, planResult.plan, preliminaryAuthority.unresolvedSourceIssues), research);
      assessment = assessTimelineQuality({
        plan: planResult.plan,
        timeline: generation.timeline,
        allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)),
        allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef))
      });
      preliminaryAuthority = assessSourceAuthority({ timeline: generation.timeline, sources: research.sources, evidenceSegments: research.evidenceSegments });
    }
    const candidate = await persistFactoryCandidate(payload, research, generation, sourceSnapshotId);
    const authorityInput = candidate.sourceSnapshotId === sourceSnapshotId
      ? { sourceSnapshotId, research }
      : { sourceSnapshotId: candidate.sourceSnapshotId, research: await loadResearchSnapshot(candidate.sourceSnapshotId) };
    await setStage(payload, "quality_validation");
    assessment = assessTimelineQuality({
      plan: planResult.plan,
      timeline: candidate.timeline,
      allowedSourceRefs: new Set(authorityInput.research.sources.map((source) => source.sourceId)),
      allowedEvidenceRefs: new Set(authorityInput.research.evidenceSegments.map((segment) => segment.evidenceRef))
    });
    const qualityArtifactId = await persistQualityArtifact(payload, planResult, assessment, candidate.timelineObjectId);
    await setStage(payload, "source_authority_validation");
    const sourceAuthority = candidate.sourceSnapshotId === sourceSnapshotId ? preliminaryAuthority : assessSourceAuthority({
      timeline: candidate.timeline,
      sources: authorityInput.research.sources,
      evidenceSegments: authorityInput.research.evidenceSegments
    });
    const sourceAuthorityArtifactId = await persistSourceAuthorityArtifact(
      payload,
      candidate.timelineObjectId,
      authorityInput.sourceSnapshotId,
      sourceAuthority,
      authorityInput.research
    );
    await setStage(payload, "reader_editorial_review");
    const readerResult = await generateReaderEditorialReview(lease.displayTitle, planResult.plan, candidate.timeline);
    const readerEditorial = assessReaderEditorialReview({ plan: planResult.plan, timeline: candidate.timeline, review: readerResult.review });
    const readerEditorialArtifactId = await persistReaderEditorialArtifact(payload, readerEditorial, readerResult.execution, candidate.timelineObjectId);
    await setStage(payload, "governance_handoff");
    const governance = await createGovernancePackage(
      payload,
      candidate.timelineObjectId,
      candidate.timeline,
      authorityInput.research.sources,
      assessment,
      qualityArtifactId,
      sourceAuthority,
      sourceAuthorityArtifactId,
      authorityInput.sourceSnapshotId,
      readerEditorial,
      readerEditorialArtifactId
    );
    if (governance.policy.outcome === "routine") {
      await enqueueInstitutionalTask({ ...payload, packageId: governance.packageId, decision: "routine" });
      return { status: "GOVERNANCE_QUEUED", packageId: governance.packageId };
    }
    return { status: "AWAITING_REVIEW", packageId: governance.packageId };
  } catch (error) {
    await recordFailure(payload, error);
    throw error;
  }
}

export async function executeNonPublicQualityFixture(displayTitle: string, fixtureClass: string, requestedJobId = randomUUID()) {
  const fixtureStartedAt = Date.now();
  await assertActiveCorpus();
  const jobId = requestedJobId;
  const topicId = authorityId("quality-fixture", displayTitle.toLocaleLowerCase("en-US"));
  const payload: TaskPayload = { corpusId: ACTIVE_CORPUS_ID, topicId, jobId, generation: 1, origin: "founder" };
  let research = await researchTopic(displayTitle);
  let sourceSnapshotId = await persistResearch(payload, research);
  let planResult = await generateEditorialPlan(displayTitle, research);
  let planReasons = assessEditorialPlan({ plan: planResult.plan, allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)), allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef)) });
  for (let planRepair = 1; planReasons.length > 0 && planRepair <= 2; planRepair += 1) {
    planResult = await generateEditorialPlan(displayTitle, research, planReasons.join("\n"));
    planReasons = assessEditorialPlan({ plan: planResult.plan, allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)), allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef)) });
  }
  let generation = applyAuthorityEvidenceSelection(await generateStructuredTimeline(displayTitle, research, planResult.plan), research);
  let assessment = assessTimelineQuality({ plan: planResult.plan, timeline: generation.timeline, allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)), allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef)) });
  for (let editorialRepair = 1; assessment.verdict === "failed" && editorialRepair <= 2; editorialRepair += 1) {
    planResult = await generateEditorialPlan(displayTitle, research, assessment.unresolvedReasons.join("\n"));
    generation = applyAuthorityEvidenceSelection(await generateStructuredTimeline(displayTitle, research, planResult.plan), research);
    assessment = assessTimelineQuality({ plan: planResult.plan, timeline: generation.timeline, allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)), allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef)) });
  }
  let sourceAuthority = assessSourceAuthority({ timeline: generation.timeline, sources: research.sources, evidenceSegments: research.evidenceSegments });
  if (assessment.verdict === "passed" && sourceAuthority.overallVerdict !== "passed") {
    const supplemental = await researchAuthorityGaps(displayTitle, generation.timeline, [...sourceAuthority.unresolvedSourceIssues, ...sourceAuthority.conflictFindings]);
    research = mergeResearchResults(research, supplemental);
    sourceSnapshotId = await persistResearch(payload, research);
    generation = applyAuthorityEvidenceSelection(await generateStructuredTimeline(displayTitle, research, planResult.plan, sourceAuthority.unresolvedSourceIssues), research);
    assessment = assessTimelineQuality({ plan: planResult.plan, timeline: generation.timeline, allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)), allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef)) });
    sourceAuthority = assessSourceAuthority({ timeline: generation.timeline, sources: research.sources, evidenceSegments: research.evidenceSegments });
  }
  const candidate = await persistFactoryCandidate(payload, research, generation, sourceSnapshotId);
  assessment = assessTimelineQuality({
    plan: planResult.plan,
    timeline: candidate.timeline,
    allowedSourceRefs: new Set(research.sources.map((source) => source.sourceId)),
    allowedEvidenceRefs: new Set(research.evidenceSegments.map((segment) => segment.evidenceRef))
  });
  const qualityArtifactId = await persistQualityArtifact(payload, planResult, assessment, candidate.timelineObjectId);
  if (candidate.sourceSnapshotId !== sourceSnapshotId) {
    const exactResearch = await loadResearchSnapshot(candidate.sourceSnapshotId);
    sourceAuthority = assessSourceAuthority({ timeline: candidate.timeline, sources: exactResearch.sources, evidenceSegments: exactResearch.evidenceSegments });
    research = exactResearch;
    sourceSnapshotId = candidate.sourceSnapshotId;
  }
  const sourceAuthorityArtifactId = await persistSourceAuthorityArtifact(payload, candidate.timelineObjectId, sourceSnapshotId, sourceAuthority, research);
  const governancePreview = evaluateRoutinePolicy(candidate.timeline, research.sources, assessment, sourceAuthority);
  await corpusCollection("factoryRuns").doc(jobId).update({
    state: assessment.verdict === "passed" && sourceAuthority.overallVerdict === "passed" ? "AUTHORITY_FIXTURE_PASSED" : "AUTHORITY_FIXTURE_FAILED",
    fixtureClass,
    publicationEligible: false,
    qualityArtifactId,
    sourceAuthorityArtifactId,
    sourceAuthorityVerdict: sourceAuthority.overallVerdict,
    researchMetrics: research.researchMetrics,
    governancePreview,
    durationMs: Date.now() - fixtureStartedAt,
    completedAt: Timestamp.now()
  });
  await createIfAbsent("factoryArtifacts", authorityId(jobId, "non-public-certification"), {
    artifactId: authorityId(jobId, "non-public-certification"),
    runId: jobId,
    topicId,
    artifactType: "non_public_quality_fixture",
    fixtureClass,
    publicationEligible: false,
    objectRef: candidate.timelineObjectId,
    qualityArtifactRef: qualityArtifactId,
    sourceAuthorityArtifactRef: sourceAuthorityArtifactId,
    sourceAuthorityVerdict: sourceAuthority.overallVerdict,
    governancePreview,
    immutable: true,
    createdAt: Timestamp.now()
  });
  return {
    jobId,
    topicId,
    timelineObjectId: candidate.timelineObjectId,
    qualityArtifactId,
    sourceAuthorityArtifactId,
    fixtureClass,
    eventCount: candidate.timeline.events.length,
    firstYear: candidate.timeline.events[0]?.sortYear,
    lastYear: candidate.timeline.events.at(-1)?.sortYear,
    verdict: assessment.verdict,
    sourceAuthorityVerdict: sourceAuthority.overallVerdict,
    sourceAuthorityIssues: sourceAuthority.unresolvedSourceIssues,
    researchMetrics: research.researchMetrics,
    durationMs: Date.now() - fixtureStartedAt,
    reasons: assessment.unresolvedReasons,
    governanceOutcome: governancePreview.outcome,
    publicationEligible: false
  };
}

export async function recordNonPublicQualityFixtureFailure(jobId: string, fixtureClass: string, error: unknown) {
  const ref = corpusCollection("factoryRuns").doc(jobId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  await ref.update({
    state: "QUALITY_FIXTURE_FAILED",
    fixtureClass,
    publicationEligible: false,
    lastError: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
    completedAt: Timestamp.now()
  });
}

async function loadPersistedV3RevisionInputs(topicId: string, priorQualityArtifactId: string) {
  const [ledger, priorQuality] = await Promise.all([
    corpusCollection("topicLedgers").doc(topicId).get(),
    corpusCollection("qualityArtifacts").doc(priorQualityArtifactId).get()
  ]);
  if (!ledger.exists || ledger.data()?.state !== "PUBLISHED") throw new Error("V3 revision preview requires an actively published topic.");
  if (!priorQuality.exists || priorQuality.data()?.topicId !== topicId) throw new Error("V3 revision preview quality lineage is missing or mismatched.");
  const priorJobId = String(priorQuality.data()?.runId || "");
  const candidateQuery = await corpusCollection("factoryObjects").where("runId", "==", priorJobId).where("objectType", "==", "candidate_timeline").limit(2).get();
  if (candidateQuery.size !== 1) throw new Error("V3 revision preview requires exactly one immutable prior candidate.");
  const priorCandidate = candidateQuery.docs[0]!;
  if (priorQuality.data()?.objectRef !== priorCandidate.id) throw new Error("V3 revision preview candidate does not match the prior quality artifact.");
  const priorTimeline = generatedTimelineSchema.parse(priorCandidate.data().payload);
  const qualityPayload = priorQuality.data()!.payload as {
    scopeAssessment?: unknown;
    candidateEventInventory?: unknown;
    redundancyAssessment?: { review?: unknown };
    omissionAssessment?: { review?: unknown };
  };
  const plan = upgradeLegacyPlanForV3({
    scope: qualityPayload.scopeAssessment,
    candidates: qualityPayload.candidateEventInventory,
    redundancyReview: qualityPayload.redundancyAssessment?.review,
    omissionReview: qualityPayload.omissionAssessment?.review
  }, priorTimeline);
  const timeline = selectV3Chronology(plan, priorTimeline);
  const resolvedResearch = await resolveCandidateResearchSnapshot(topicId, priorJobId, priorCandidate.data());
  return { ledger, priorQuality, priorCandidate, priorJobId, priorTimeline, plan, timeline, ...resolvedResearch };
}

export async function executePersistedV3RevisionPreview(topicId: string, priorQualityArtifactId: string) {
  await assertActiveCorpus();
  const input = await loadPersistedV3RevisionInputs(topicId, priorQualityArtifactId);
  const jobId = authorityId(topicId, QUALITY_POLICY_VERSION, "revision-preview");
  const generation = Number(input.ledger.data()?.generation || 0) + 1;
  const payload: TaskPayload = { corpusId: ACTIVE_CORPUS_ID, topicId, jobId, generation, origin: "founder" };
  const now = Timestamp.now();
  await createIfAbsent("factoryRuns", jobId, {
    runId: jobId,
    topicId,
    jobId,
    generation,
    pipelineVersion: PIPELINE_VERSION,
    qualityPolicyVersion: QUALITY_POLICY_VERSION,
    fixtureClass: "persisted_apollo_v3_revision_preview",
    publicationEligible: false,
    state: "QUALITY_FIXTURE_RUNNING",
    sourceJobId: input.priorJobId,
    sourceCandidateId: input.priorCandidate.id,
    sourceSnapshotId: input.sourceSnapshotId,
    createdAt: now
  });
  const execution = {
    projectId: "deterministic",
    location: "local-policy",
    model: "deterministic-policy-transform",
    promptVersion: QUALITY_POLICY_VERSION,
    schemaVersion: SCHEMA_VERSION,
    promptHash: hashValue(stableJson({ priorQualityArtifactId, priorCandidateId: input.priorCandidate.id })),
    responseHash: hashValue(stableJson(input.timeline)),
    startedAt: now.toDate().toISOString(),
    completedAt: now.toDate().toISOString(),
    usageMetadata: { vertexCalls: 0 }
  };
  const candidate = await persistFactoryCandidate(payload, input.research, { timeline: input.timeline, execution }, input.sourceSnapshotId);
  const assessment = assessTimelineQuality({
    plan: input.plan,
    timeline: candidate.timeline,
    allowedSourceRefs: new Set(input.research.sources.map((source) => source.sourceId)),
    allowedEvidenceRefs: new Set(input.research.evidenceSegments.map((segment) => segment.evidenceRef))
  });
  const planResult: EditorialPlanResult = { plan: input.plan, execution };
  const qualityArtifactId = await persistQualityArtifact(payload, planResult, assessment, candidate.timelineObjectId);
  const sourceAuthority = assessSourceAuthority({ timeline: candidate.timeline, sources: input.research.sources, evidenceSegments: input.research.evidenceSegments });
  const sourceAuthorityArtifactId = await persistSourceAuthorityArtifact(payload, candidate.timelineObjectId, input.sourceSnapshotId, sourceAuthority, input.research);
  const governancePreview = evaluateRoutinePolicy(candidate.timeline, input.research.sources, assessment, sourceAuthority);
  await corpusCollection("factoryRuns").doc(jobId).update({
    state: assessment.verdict === "passed" && sourceAuthority.overallVerdict === "passed" && governancePreview.outcome === "routine" ? "QUALITY_FIXTURE_PASSED" : "QUALITY_FIXTURE_FAILED",
    qualityArtifactId,
    sourceAuthorityArtifactId,
    qualityVerdict: assessment.verdict,
    sourceAuthorityVerdict: sourceAuthority.overallVerdict,
    governancePreview,
    originalEventCount: input.priorTimeline.events.length,
    correctedEventCount: candidate.timeline.events.length,
    excludedItems: input.plan.candidates.filter((item) => !item.selected).map((item) => ({ candidateId: item.candidateId, title: item.title, semanticType: item.semanticType, reason: item.rejectionReason })),
    completedAt: Timestamp.now()
  });
  await createIfAbsent("factoryArtifacts", authorityId(jobId, "non-public-v3-revision-preview"), {
    artifactId: authorityId(jobId, "non-public-v3-revision-preview"),
    runId: jobId,
    topicId,
    artifactType: "non_public_v3_revision_preview",
    publicationEligible: false,
    sourceJobId: input.priorJobId,
    sourceCandidateId: input.priorCandidate.id,
    sourceSnapshotId: input.sourceSnapshotId,
    objectRef: candidate.timelineObjectId,
    qualityArtifactRef: qualityArtifactId,
    sourceAuthorityArtifactRef: sourceAuthorityArtifactId,
    governancePreview,
    immutable: true,
    createdAt: Timestamp.now()
  });
  return {
    jobId,
    generation,
    timelineObjectId: candidate.timelineObjectId,
    sourceSnapshotId: input.sourceSnapshotId,
    qualityArtifactId,
    sourceAuthorityArtifactId,
    qualityVerdict: assessment.verdict,
    sourceAuthorityVerdict: sourceAuthority.overallVerdict,
    governanceOutcome: governancePreview.outcome,
    originalEventCount: input.priorTimeline.events.length,
    correctedEventCount: candidate.timeline.events.length,
    eventTitles: candidate.timeline.events.map((event) => event.title),
    excludedItems: input.plan.candidates.filter((item) => !item.selected && input.priorTimeline.events.some((event) => event.title === item.title)).map((item) => ({ title: item.title, semanticType: item.semanticType, reason: item.rejectionReason })),
    reasons: assessment.unresolvedReasons,
    publicationEligible: false
  };
}

export async function promotePersistedV3Revision(topicId: string, priorQualityArtifactId: string) {
  await assertActiveCorpus();
  const preview = await executePersistedV3RevisionPreview(topicId, priorQualityArtifactId);
  if (preview.qualityVerdict !== "passed" || preview.sourceAuthorityVerdict !== "passed" || preview.governanceOutcome !== "routine") {
    throw new Error("Non-public V3 revision preview is not eligible for institutional promotion.");
  }
  const input = await loadPersistedV3RevisionInputs(topicId, priorQualityArtifactId);
  const payload: TaskPayload = { corpusId: ACTIVE_CORPUS_ID, topicId, jobId: preview.jobId, generation: preview.generation, origin: "founder" };
  const candidate = (await corpusCollection("factoryObjects").doc(preview.timelineObjectId).get()).data()!;
  const timeline = generatedTimelineSchema.parse(candidate.payload);
  const assessment = assessTimelineQuality({ plan: input.plan, timeline, allowedSourceRefs: new Set(input.research.sources.map((source) => source.sourceId)), allowedEvidenceRefs: new Set(input.research.evidenceSegments.map((segment) => segment.evidenceRef)) });
  const sourceAuthority = assessSourceAuthority({ timeline, sources: input.research.sources, evidenceSegments: input.research.evidenceSegments });
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const ledgerRef = corpusCollection("topicLedgers").doc(topicId);
    const ledger = await transaction.get(ledgerRef);
    if (ledger.data()?.state !== "PUBLISHED" || ledger.data()?.generation !== preview.generation - 1 || ledger.data()?.publishedMemoryId !== `${topicId}--g${preview.generation - 1}`) {
      throw new Error("Published topic changed after V3 preview; revision promotion fails closed.");
    }
    transaction.create(corpusCollection("generationJobs").doc(preview.jobId), corpusRecord({
      jobId: preview.jobId, topicId, generation: preview.generation, origin: "founder", priority: 1000,
      state: "PROCESSING", currentStage: "governance_handoff", attemptCount: 0, maximumAttempts: MAX_TOPIC_ATTEMPTS,
      revisionOfPublishedMemoryId: ledger.data()!.publishedMemoryId, sourceCandidateId: input.priorCandidate.id, sourceSnapshotId: input.sourceSnapshotId,
      createdAt: now, startedAt: now, updatedAt: now
    }));
    transaction.update(ledgerRef, {
      state: "PROCESSING", currentStage: "governance_handoff", activeJobId: preview.jobId, generation: preview.generation,
      deterministicTaskIdentity: `${ACTIVE_CORPUS_ID}-${topicId}-g${preview.generation}`, attemptCount: 0,
      leaseOwner: null, leaseExpiresAt: null, lastError: null, updatedAt: now
    });
  });
  const governance = await createGovernancePackage(payload, preview.timelineObjectId, timeline, input.research.sources, assessment, preview.qualityArtifactId, sourceAuthority, preview.sourceAuthorityArtifactId, input.sourceSnapshotId);
  if (governance.policy.outcome !== "routine") throw new Error("V3 revision Governance package is exceptional after passing preview.");
  await enqueueInstitutionalTask({ ...payload, packageId: governance.packageId, decision: "routine" });
  await corpusCollection("generationJobs").doc(preview.jobId).update({ packageId: governance.packageId, state: "GOVERNANCE_QUEUED", currentStage: "governance", updatedAt: Timestamp.now() });
  await corpusCollection("topicLedgers").doc(topicId).update({ state: "GOVERNANCE_QUEUED", currentStage: "governance", updatedAt: Timestamp.now() });
  await createIfAbsent("auditEvents", randomUUID(), {
    institution: "factory", topicId, jobId: preview.jobId, packageId: governance.packageId,
    eventType: "TIMELINE_QUALITY_V3_REVISION_PROMOTED",
    lineage: { priorPublishedMemoryId: `${topicId}--g${preview.generation - 1}`, priorQualityArtifactId, qualityArtifactId: preview.qualityArtifactId, sourceCandidateId: input.priorCandidate.id, revisedCandidateId: preview.timelineObjectId, sourceSnapshotId: input.sourceSnapshotId, qualityPolicyVersion: QUALITY_POLICY_VERSION },
    immutable: true, createdAt: Timestamp.now()
  });
  return { ...preview, packageId: governance.packageId, status: "GOVERNANCE_QUEUED" as const };
}

export async function resumePersistedV3InstitutionalTransition(topicId: string) {
  await assertActiveCorpus();
  const ledger = await corpusCollection("topicLedgers").doc(topicId).get();
  const data = ledger.data();
  if (!ledger.exists || data?.state !== "GOVERNANCE_QUEUED" || data?.currentStage !== "governance") {
    throw new Error("V3 institutional resume requires an unchanged GOVERNANCE_QUEUED ledger.");
  }
  const jobId = String(data.activeJobId || "");
  const generation = Number(data.generation || 0);
  const job = await corpusCollection("generationJobs").doc(jobId).get();
  if (!job.exists || job.data()?.state !== "GOVERNANCE_QUEUED" || job.data()?.generation !== generation) {
    throw new Error("V3 institutional resume job lineage is missing or no longer queued.");
  }
  const packageId = String(job.data()?.packageId || "");
  const governancePackage = await corpusCollection("governancePackages").doc(packageId).get();
  if (!governancePackage.exists || governancePackage.data()?.policyEvaluation?.outcome !== "routine") {
    throw new Error("V3 institutional resume requires the existing routine Governance package.");
  }
  const payload: TaskPayload = { corpusId: ACTIVE_CORPUS_ID, topicId, jobId, generation, origin: "founder" };
  const delivery = await enqueueInstitutionalTask({ ...payload, packageId, decision: "routine" }, "institutional-v3-schema-recovery");
  return { topicId, jobId, generation, packageId, delivery };
}

export async function executeNonPublicSourceAuthorityClaimFixture(input: {
  displayTitle: string;
  fixtureClass: string;
  event: GeneratedTimeline["events"][number];
  requestedJobId?: string;
}) {
  await assertActiveCorpus();
  const startedAt = Date.now();
  const jobId = input.requestedJobId || randomUUID();
  const topicId = authorityId("source-authority-fixture", input.displayTitle.toLocaleLowerCase("en-US"));
  const payload: TaskPayload = { corpusId: ACTIVE_CORPUS_ID, topicId, jobId, generation: 1, origin: "founder" };
  const fixtureTimeline = {
    title: input.displayTitle,
    description: `A non-public claim-level Source Authority V2 fixture for ${input.displayTitle}.`,
    category: "Certification",
    tags: ["source authority", input.fixtureClass],
    events: [{ ...input.event, sourceRefs: ["pending-source"], evidenceRefs: ["pending-evidence"] }]
  } as GeneratedTimeline;
  const targetedResearch = await researchAuthorityGaps(input.displayTitle, fixtureTimeline, ["Establish claim-relevant authority and required independent corroboration for this exact material claim."]);
  const research: ResearchResult = {
    ...targetedResearch,
    researchMetrics: {
      groundedSearchCallCount: targetedResearch.researchMetrics.groundedSearchCallCount,
      additionalVertexCallCount: Math.max(0, targetedResearch.researchMetrics.groundedSearchCallCount - 1),
      repairCallCount: 0
    }
  };
  const sourceSnapshotId = await persistResearch(payload, research);
  const selectedTimeline = selectAuthoritativeEvidence({ timeline: fixtureTimeline, sources: research.sources, evidenceSegments: research.evidenceSegments });
  const assessment = assessSourceAuthority({ timeline: selectedTimeline, sources: research.sources, evidenceSegments: research.evidenceSegments });
  const objectId = authorityId(jobId, "source-authority-live-fixture");
  await createIfAbsent("factoryObjects", objectId, {
    objectId,
    runId: jobId,
    topicId,
    objectType: "source_authority_live_fixture",
    fixtureClass: input.fixtureClass,
    payload: selectedTimeline,
    sourceSnapshotId,
    publicationEligible: false,
    immutable: true,
    createdAt: Timestamp.now()
  });
  const sourceAuthorityArtifactId = await persistSourceAuthorityArtifact(payload, objectId, sourceSnapshotId, assessment, research);
  const durationMs = Date.now() - startedAt;
  await corpusCollection("factoryRuns").doc(jobId).update({
    state: assessment.overallVerdict === "passed" ? "AUTHORITY_FIXTURE_PASSED" : "AUTHORITY_FIXTURE_FAILED",
    fixtureClass: input.fixtureClass,
    sourceAuthorityArtifactId,
    sourceAuthorityVerdict: assessment.overallVerdict,
    publicationEligible: false,
    researchMetrics: research.researchMetrics,
    durationMs,
    completedAt: Timestamp.now()
  });
  return {
    jobId,
    topicId,
    objectId,
    sourceSnapshotId,
    sourceAuthorityArtifactId,
    fixtureClass: input.fixtureClass,
    sourceAuthorityVerdict: assessment.overallVerdict,
    sourceAuthorityIssues: assessment.unresolvedSourceIssues,
    conflictFindings: assessment.conflictFindings,
    sourceDiversity: assessment.sourceDiversity,
    researchMetrics: research.researchMetrics,
    durationMs,
    publicationEligible: false
  };
}

export async function reassessPersistedGeneration(payload: TaskPayload, priorQualityArtifactId: string) {
  requireTaskCorpus(payload.corpusId);
  await assertActiveCorpus();
  const [ledger, priorQuality, candidateQuery] = await Promise.all([
    corpusCollection("topicLedgers").doc(payload.topicId).get(),
    corpusCollection("qualityArtifacts").doc(priorQualityArtifactId).get(),
    corpusCollection("factoryObjects").where("runId", "==", payload.jobId).where("objectType", "==", "candidate_timeline").limit(1).get()
  ]);
  if (!ledger.exists || !priorQuality.exists || candidateQuery.empty) throw new Error("Persisted reassessment input is incomplete.");
  if (ledger.data()?.activeJobId !== payload.jobId || ledger.data()?.generation !== payload.generation) throw new Error("Persisted reassessment does not own the active generation.");
  if (ledger.data()?.state !== "AWAITING_REVIEW") throw new Error("Persisted reassessment requires an AWAITING_REVIEW topic.");
  const prior = priorQuality.data()!;
  if (prior.topicId !== payload.topicId || prior.runId !== payload.jobId) throw new Error("Prior quality artifact lineage does not match the requested generation.");
  const qualityPayload = prior.payload as {
    scopeAssessment?: unknown;
    candidateEventInventory?: unknown;
    redundancyAssessment?: { review?: unknown };
    omissionAssessment?: { review?: unknown };
  };
  const plan = timelineEditorialPlanSchema.parse({
    scope: qualityPayload.scopeAssessment,
    candidates: qualityPayload.candidateEventInventory,
    redundancyReview: qualityPayload.redundancyAssessment?.review,
    omissionReview: qualityPayload.omissionAssessment?.review
  });
  const candidateDocument = candidateQuery.docs[0]!;
  const timelineObjectId = candidateDocument.id;
  if (prior.objectRef !== timelineObjectId) throw new Error("Prior quality artifact does not reference the persisted timeline candidate.");
  const timeline = generatedTimelineSchema.parse(candidateDocument.data().payload);
  const resolvedResearch = await resolveCandidateResearchSnapshot(payload.topicId, payload.jobId, candidateDocument.data());
  const research = resolvedResearch.research;
  const sources = research.sources;
  const evidenceSegments = research.evidenceSegments;
  const assessment = assessTimelineQuality({
    plan,
    timeline,
    allowedSourceRefs: new Set(sources.map((source) => source.sourceId)),
    allowedEvidenceRefs: new Set(evidenceSegments.map((segment: { evidenceRef?: unknown }) => String(segment.evidenceRef || "")))
  });
  if (assessment.verdict !== "passed") return { status: "AWAITING_REVIEW" as const, assessment };
  const planResult = { plan, execution: prior.modelProvenance } as EditorialPlanResult;
  const qualityArtifactId = await persistQualityArtifact(payload, planResult, assessment, timelineObjectId);
  const sourceAuthority = assessSourceAuthority({ timeline, sources, evidenceSegments });
  const sourceAuthorityArtifactId = await persistSourceAuthorityArtifact(
    payload,
    timelineObjectId,
    resolvedResearch.sourceSnapshotId,
    sourceAuthority,
    research
  );
  const readerResult = await generateReaderEditorialReview(plan.scope.topic, plan, timeline);
  const readerEditorial = assessReaderEditorialReview({ plan, timeline, review: readerResult.review });
  const readerEditorialArtifactId = await persistReaderEditorialArtifact(payload, readerEditorial, readerResult.execution, timelineObjectId);
  const governance = await createGovernancePackage(
    payload,
    timelineObjectId,
    timeline,
    sources,
    assessment,
    qualityArtifactId,
    sourceAuthority,
    sourceAuthorityArtifactId,
    resolvedResearch.sourceSnapshotId,
    readerEditorial,
    readerEditorialArtifactId
  );
  if (governance.policy.outcome !== "routine") return { status: "AWAITING_REVIEW" as const, assessment, qualityArtifactId, packageId: governance.packageId };
  await enqueueInstitutionalTask({ ...payload, packageId: governance.packageId, decision: "routine" });
  const reviewQueueSnapshot = await corpusCollection("governanceQueues").where("topicId", "==", payload.topicId).limit(20).get();
  const supersededQueues = reviewQueueSnapshot.docs.filter((document) => document.data().lifecycle === "ENTERED");
  const now = Timestamp.now();
  const batch = db.batch();
  for (const document of supersededQueues) batch.update(document.ref, {
    lifecycle: "SUPERSEDED",
    resolution: "QUALITY_POLICY_REASSESSMENT_PASSED",
    supersededByPackageId: governance.packageId,
    resolvedAt: now
  });
  batch.create(corpusCollection("auditEvents").doc(randomUUID()), {
    institution: "governance",
    topicId: payload.topicId,
    jobId: payload.jobId,
    packageId: governance.packageId,
    eventType: "QUALITY_POLICY_REASSESSMENT_PASSED",
    lineage: { priorQualityArtifactId, qualityArtifactId, policyVersion: QUALITY_POLICY_VERSION },
    immutable: true,
    createdAt: now
  });
  await batch.commit();
  return { status: "GOVERNANCE_QUEUED" as const, assessment, qualityArtifactId, sourceAuthorityArtifactId, packageId: governance.packageId, supersededReviewCount: supersededQueues.length };
}

async function recordFailure(payload: TaskPayload, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await db.runTransaction(async (transaction) => {
    const ledgerRef = corpusCollection("topicLedgers").doc(payload.topicId);
    const ledger = await transaction.get(ledgerRef);
    if (!ledger.exists || ledger.data()?.activeJobId !== payload.jobId) return;
    const attempts = Number(ledger.data()?.attemptCount || 0);
    const terminal = attempts >= Number(ledger.data()?.maximumAttempts || MAX_TOPIC_ATTEMPTS);
    const now = Timestamp.now();
    transaction.update(ledgerRef, {
      state: terminal ? "FAILED" : "RETRY_SCHEDULED",
      currentStage: terminal ? "terminal" : ledger.data()?.currentStage,
      nextRetryAt: terminal ? null : Timestamp.fromMillis(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1))),
      lastError: message.slice(0, 2000),
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: now
    });
    transaction.update(corpusCollection("generationJobs").doc(payload.jobId), {
      state: terminal ? "FAILED" : "RETRY_SCHEDULED",
      lastError: message.slice(0, 2000),
      updatedAt: now
    });
    transaction.create(corpusCollection("failureRecords").doc(randomUUID()), {
      topicId: payload.topicId,
      jobId: payload.jobId,
      generation: payload.generation,
      stage: ledger.data()?.currentStage || "unknown",
      attempt: attempts,
      retryable: !terminal,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: message.slice(0, 2000),
      createdAt: now
    });
  });
}

type PublicIdAllocation = { timelineId: number; eventIds: number[]; sourceIds: Record<string, number>; tagIds: Record<string, number> };

async function allocatePublicIds(payload: TaskPayload, timeline: GeneratedTimeline, sources: SourceCandidate[]): Promise<PublicIdAllocation> {
  const jobRef = corpusCollection("generationJobs").doc(payload.jobId);
  const counterRef = corpusCollection("counters").doc("publicIds");
  const ledgerSnapshot = await corpusCollection("topicLedgers").doc(payload.topicId).get();
  const existingTimelineRef = typeof ledgerSnapshot.data()?.slug === "string"
    ? corpusCollection("platformReadModels").doc(`timeline--${ledgerSnapshot.data()!.slug}`)
    : null;
  return db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(jobRef, counterRef, ...(existingTimelineRef ? [existingTimelineRef] : []));
    const job = snapshots[0]!;
    const counter = snapshots[1]!;
    const existingTimeline = snapshots[2]?.data()?.payload as { id?: number; events?: Array<{ id?: number; date?: string; title?: string; sources?: Array<{ id?: number; url?: string }>; tags?: Array<{ id?: number; slug?: string }> }>; tags?: Array<{ id?: number; slug?: string }> } | undefined;
    if (job.data()?.publicIds) return job.data()!.publicIds as PublicIdAllocation;
    const current = counter.data() || {};
    let timelineCursor = Number(current.timeline ?? PUBLIC_ID_BASE);
    let eventCursor = Number(current.event ?? PUBLIC_ID_BASE);
    let sourceCursor = Number(current.source ?? PUBLIC_ID_BASE);
    let tagCursor = Number(current.tag ?? PUBLIC_ID_BASE);
    const sourceIds: Record<string, number> = {};
    const existingSourceIds = new Map((existingTimeline?.events || []).flatMap((event) => event.sources || []).filter((source) => typeof source.id === "number" && typeof source.url === "string").map((source) => [source.url!, source.id!]));
    for (const source of sources) sourceIds[source.sourceId] = existingSourceIds.get(source.url) || ++sourceCursor;
    const tagIds: Record<string, number> = {};
    const existingTagIds = new Map([...(existingTimeline?.tags || []), ...(existingTimeline?.events || []).flatMap((event) => event.tags || [])].filter((tag) => typeof tag.id === "number" && typeof tag.slug === "string").map((tag) => [tag.slug!, tag.id!]));
    for (const tag of Array.from(new Set([...timeline.tags, ...timeline.events.flatMap((event) => event.tags)]))) {
      const slug = slugifyTopic(tag);
      tagIds[slug] = existingTagIds.get(slug) || ++tagCursor;
    }
    const existingEventIds = new Map((existingTimeline?.events || []).filter((event) => typeof event.id === "number").map((event) => [`${event.date}:${String(event.title).toLocaleLowerCase("en-US")}`, event.id!]));
    const allocation: PublicIdAllocation = {
      timelineId: typeof existingTimeline?.id === "number" ? existingTimeline.id : ++timelineCursor,
      eventIds: timeline.events.map((event) => existingEventIds.get(`${event.date}:${event.title.toLocaleLowerCase("en-US")}`) || ++eventCursor),
      sourceIds,
      tagIds
    };
    transaction.set(counterRef, { timeline: timelineCursor, event: eventCursor, source: sourceCursor, tag: tagCursor, updatedAt: Timestamp.now() }, { merge: true });
    transaction.update(jobRef, { publicIds: allocation, updatedAt: Timestamp.now() });
    return allocation;
  });
}

function tokenize(value: string) {
  return Array.from(new Set(value.normalize("NFKD").replace(/\p{M}+/gu, "").toLocaleLowerCase("en-US").split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2))).slice(0, 200);
}

function timelineSummary(detail: Record<string, unknown>) {
  const { events: _events, relatedTimelines: _related, ...summary } = detail;
  return summary;
}

function buildProjection(payload: TaskPayload, topic: FirebaseFirestore.DocumentData, timeline: GeneratedTimeline, sources: SourceCandidate[], ids: PublicIdAllocation) {
  const createdAt = new Date().toISOString();
  const tagRecords = Object.entries(ids.tagIds).map(([slug, id]) => ({ id, slug, name: [...timeline.tags, ...timeline.events.flatMap((event) => event.tags)].find((tag) => slugifyTopic(tag) === slug) || slug }));
  const sourceRecords = sources.map((source) => ({ id: ids.sourceIds[source.sourceId]!, publisher: source.publisher, url: source.url, credibilityScore: 0.8 }));
  const events = timeline.events.map((event, index) => ({
    id: ids.eventIds[index]!,
    date: event.date,
    legacyDate: event.date,
    displayDate: event.date,
    datePrecision: event.datePrecision,
    sortYear: event.sortYear,
    sortMonth: event.sortMonth,
    sortDay: event.sortDay,
    title: event.title,
    description: event.description,
    importance: event.importance,
    location: event.location,
    imageUrl: null,
    createdAt,
    updatedAt: createdAt,
    sources: event.sourceRefs.map((sourceRef) => sourceRecords.find((source) => source.id === ids.sourceIds[sourceRef])!).filter(Boolean),
    tags: event.tags.map((tag) => tagRecords.find((record) => record.slug === slugifyTopic(tag))!).filter(Boolean),
    timelineLinks: [{ timelineId: ids.timelineId, slug: topic.slug, title: timeline.title, eventOrder: index }]
  }));
  const detail = {
    id: ids.timelineId,
    title: timeline.title,
    slug: topic.slug,
    description: timeline.description,
    category: timeline.category,
    orderingMode: "chronology",
    createdAt,
    updatedAt: createdAt,
    tags: tagRecords.filter((tag) => timeline.tags.some((name) => slugifyTopic(name) === tag.slug)),
    eventCount: events.length,
    highlightedEventTitles: events.filter((event) => event.importance >= 4).slice(0, 3).map((event) => event.title),
    events,
    relatedTimelines: []
  };
  return { createdAt, detail, events, tagRecords, sourceRecords };
}

export async function executeInstitutionalTransition(payload: TaskPayload & { packageId: string; decision: "routine" | "exceptional" }) {
  requireTaskCorpus(payload.corpusId);
  if (payload.decision !== "routine") return { status: "AWAITING_REVIEW" };
  const [ledger, packageSnapshot, candidateQuery] = await Promise.all([
    corpusCollection("topicLedgers").doc(payload.topicId).get(),
    corpusCollection("governancePackages").doc(payload.packageId).get(),
    corpusCollection("factoryObjects").where("runId", "==", payload.jobId).where("objectType", "==", "candidate_timeline").limit(1).get()
  ]);
  if (!ledger.exists || !packageSnapshot.exists || candidateQuery.empty) throw new Error("Institutional transition input is incomplete.");
  if (ledger.data()?.state === "PUBLISHED") return { status: "NO_OP", reason: "already_published" };
  if (ledger.data()?.activeJobId !== payload.jobId || ledger.data()?.generation !== payload.generation) return { status: "NO_OP", reason: "stale_generation" };
  const packageData = packageSnapshot.data()!;
  if (
    packageData.topicId !== payload.topicId ||
    packageData.jobId !== payload.jobId ||
    packageData.generation !== payload.generation ||
    packageData.lifecycle !== "GOVERNANCE_READY" ||
    packageData.policyEvaluation?.outcome !== "routine" ||
    packageData.policyVersion !== GOVERNANCE_POLICY_VERSION ||
    packageData.qualityVerdict !== "passed" ||
    packageData.qualityPolicyVersion !== QUALITY_POLICY_VERSION ||
    packageData.readerEditorialVerdict !== "passed" ||
    packageData.readerEditorialPolicyVersion !== READER_EDITORIAL_POLICY_VERSION ||
    packageData.sourceAuthorityVerdict !== "passed" ||
    packageData.sourceAuthorityPolicyVersion !== SOURCE_AUTHORITY_POLICY_VERSION ||
    typeof packageData.sourceAuthorityArtifactRef !== "string" ||
    typeof packageData.qualityArtifactRef !== "string" ||
    typeof packageData.readerEditorialArtifactRef !== "string" ||
    typeof packageData.sourceSnapshotRef !== "string"
  ) throw new Error("Governance package lacks current passing Timeline Quality, Reader Editorial, or Source Authority verdicts.");
  const candidateDocument = candidateQuery.docs[0]!;
  if (!Array.isArray(packageData.factoryObjectRefs) || !packageData.factoryObjectRefs.includes(candidateDocument.id)) {
    throw new Error("Governance package does not reference the candidate timeline object.");
  }
  const timeline = generatedTimelineSchema.parse(candidateDocument.data().payload);
  const [sourceAuthorityArtifact, qualityArtifact, readerEditorialArtifact, research] = await Promise.all([
    corpusCollection("sourceAuthorityArtifacts").doc(packageData.sourceAuthorityArtifactRef).get(),
    corpusCollection("qualityArtifacts").doc(packageData.qualityArtifactRef).get(),
    corpusCollection("qualityArtifacts").doc(packageData.readerEditorialArtifactRef).get(),
    loadResearchSnapshot(packageData.sourceSnapshotRef)
  ]);
  if (
    !qualityArtifact.exists ||
    qualityArtifact.data()?.topicId !== payload.topicId ||
    qualityArtifact.data()?.runId !== payload.jobId ||
    qualityArtifact.data()?.objectRef !== candidateDocument.id ||
    qualityArtifact.data()?.payload?.qualityPolicyVersion !== QUALITY_POLICY_VERSION ||
    qualityArtifact.data()?.payload?.finalQualityVerdict !== "passed" ||
    qualityArtifact.data()?.payloadHash !== hashValue(stableJson(qualityArtifact.data()?.payload))
  ) throw new Error("Timeline Quality artifact lineage is missing, stale, non-passing, or corrupted.");
  if (
    !readerEditorialArtifact.exists ||
    readerEditorialArtifact.data()?.topicId !== payload.topicId ||
    readerEditorialArtifact.data()?.runId !== payload.jobId ||
    readerEditorialArtifact.data()?.objectRef !== candidateDocument.id ||
    readerEditorialArtifact.data()?.policyVersion !== READER_EDITORIAL_POLICY_VERSION ||
    readerEditorialArtifact.data()?.payload?.candidateRef !== candidateDocument.id ||
    readerEditorialArtifact.data()?.payload?.verdict !== "passed" ||
    readerEditorialArtifact.data()?.payload?.informedReaderVerdict !== "publication_worthy" ||
    !Array.isArray(readerEditorialArtifact.data()?.payload?.criteria) ||
    readerEditorialArtifact.data()?.payload?.criteria.length !== 9 ||
    readerEditorialArtifact.data()?.payload?.criteria.some((criterion: { verdict?: unknown }) => criterion.verdict !== "passed") ||
    !Array.isArray(readerEditorialArtifact.data()?.payload?.unresolvedReasons) ||
    readerEditorialArtifact.data()?.payload?.unresolvedReasons.length !== 0 ||
    readerEditorialArtifact.data()?.payloadHash !== hashValue(stableJson(readerEditorialArtifact.data()?.payload))
  ) throw new Error("Reader editorial artifact lineage is missing, stale, non-passing, or corrupted.");
  if (!sourceAuthorityArtifact.exists) throw new Error("Source Authority V2 artifact lineage is missing.");
  if (candidateDocument.data().sourceSnapshotId !== packageData.sourceSnapshotRef) throw new Error("Candidate and Source Authority snapshot lineage do not match.");
  if (candidateDocument.data().payloadHash !== hashValue(stableJson(timeline))) throw new Error("Candidate timeline payload integrity check failed.");
  const authorityDefects = sourceAuthorityPublicationDefects({
    topicId: payload.topicId,
    jobId: payload.jobId,
    timelineObjectId: candidateDocument.id,
    sourceSnapshotId: packageData.sourceSnapshotRef,
    timeline,
    artifact: sourceAuthorityArtifact.data()!
  });
  if (authorityDefects.length > 0) throw new Error(`Source Authority V2 publication gate failed: ${authorityDefects.join(" ")}`);
  const sources = research.sources;
  if (sources.length < 2) throw new Error("Institutional transition cannot resolve required source lineage.");
  const researchSourceRefs = new Set(sources.map((source) => source.sourceId));
  if (timeline.events.some((event) => event.sourceRefs.some((sourceRef) => !researchSourceRefs.has(sourceRef)))) {
    throw new Error("Candidate source references do not resolve in the certified research snapshot.");
  }
  const evidenceLineage = timeline.events.flatMap((event, eventIndex) => event.evidenceRefs.map((evidenceRef) => {
    const evidenceId = authorityId(payload.jobId, "evidence", String(eventIndex), evidenceRef);
    const validationId = authorityId(evidenceId, GOVERNANCE_POLICY_VERSION);
    const claimLinkId = authorityId(payload.jobId, "claim-link", String(eventIndex), evidenceRef);
    return { eventIndex, evidenceRef, evidenceId, validationId, claimLinkId };
  }));
  const lineageSnapshots = await db.getAll(...evidenceLineage.flatMap((lineage) => [
    corpusCollection("evidenceRecords").doc(lineage.evidenceId),
    corpusCollection("evidenceValidations").doc(lineage.validationId),
    corpusCollection("claimLinks").doc(lineage.claimLinkId)
  ]));
  for (let index = 0; index < evidenceLineage.length; index += 1) {
    const lineage = evidenceLineage[index]!;
    const evidence = lineageSnapshots[index * 3];
    const validation = lineageSnapshots[index * 3 + 1];
    const claimLink = lineageSnapshots[index * 3 + 2];
    const expectedEventObjectId = authorityId(payload.jobId, "event", String(lineage.eventIndex));
    if (!evidence?.exists || evidence.data()?.topicId !== payload.topicId || evidence.data()?.jobId !== payload.jobId ||
      evidence.data()?.sourceSnapshotId !== packageData.sourceSnapshotRef || evidence.data()?.groundingSegment?.evidenceRef !== lineage.evidenceRef) {
      throw new Error(`Evidence lineage ${lineage.evidenceId} is missing or does not match the certified snapshot.`);
    }
    if (!validation?.exists || validation.data()?.evidenceId !== lineage.evidenceId || validation.data()?.policyVersion !== GOVERNANCE_POLICY_VERSION || validation.data()?.result !== "PASSED") {
      throw new Error(`Evidence validation ${lineage.validationId} is missing, stale, or non-passing.`);
    }
    if (!claimLink?.exists || claimLink.data()?.topicId !== payload.topicId || claimLink.data()?.factoryObjectId !== expectedEventObjectId ||
      claimLink.data()?.evidenceId !== lineage.evidenceId || claimLink.data()?.validationId !== lineage.validationId) {
      throw new Error(`Claim link ${lineage.claimLinkId} is missing or stale.`);
    }
  }
  const decisionId = authorityId(payload.packageId, "routine-decision");
  const approvalId = authorityId(decisionId, "approval");
  const admissionId = authorityId(payload.packageId, "library-admission");
  const publishedMemoryId = `${payload.topicId}--g${payload.generation}`;
  const now = Timestamp.now();
  await createIfAbsent("governanceDecisions", decisionId, {
    decisionId, packageId: payload.packageId, topicId: payload.topicId, outcome: "APPROVED", decisionType: "CERTIFY_AND_ACCEPT_ROUTINE_PACKAGE",
    policyVersion: GOVERNANCE_POLICY_VERSION, actor: { id: "governance-decision-engine", institution: "governance" }, immutable: true, createdAt: now
  });
  await createIfAbsent("governanceApprovals", approvalId, {
    approvalId, decisionId, packageId: payload.packageId, approvalType: "AUTOMATED_ROUTINE_POLICY", policyVersion: GOVERNANCE_POLICY_VERSION,
    actor: { id: "governance-decision-engine", institution: "governance" }, immutable: true, createdAt: now
  });
  await createIfAbsent("governanceAudits", authorityId(decisionId, "audit"), {
    auditId: authorityId(decisionId, "audit"), topicId: payload.topicId, packageId: payload.packageId, decisionId, approvalId,
    transition: { from: "GOVERNANCE_READY", to: "APPROVED_FOR_LIBRARY" }, policyVersion: GOVERNANCE_POLICY_VERSION, immutable: true, createdAt: now
  });
  await createIfAbsent("libraryAdmissions", admissionId, {
    admissionId, topicId: payload.topicId, packageId: payload.packageId, decisionId, approvalId, generation: payload.generation,
    lifecycle: "ADMITTED", authorityRefs: [candidateDocument.id], evidenceQuery: { topicId: payload.topicId, result: "PASSED" },
    sourceAuthorityArtifactRef: packageData.sourceAuthorityArtifactRef, sourceAuthorityPolicyVersion: SOURCE_AUTHORITY_POLICY_VERSION,
    sourceAuthorityVerdict: "passed", sourceSnapshotRef: packageData.sourceSnapshotRef, immutable: true, createdAt: now
  });
  const ids = await allocatePublicIds(payload, timeline, sources);
  const projection = buildProjection(payload, ledger.data()!, timeline, sources, ids);
  const projectionHash = hashValue(stableJson(projection.detail));
  const batch = db.batch();
  const publishedRef = corpusCollection("publishedMemory").doc(publishedMemoryId);
  const existingPublished = await publishedRef.get();
  if (!existingPublished.exists) {
    batch.create(publishedRef, {
      publishedMemoryId, topicId: payload.topicId, admissionId, packageId: payload.packageId, decisionId, approvalId,
      generation: payload.generation, version: payload.generation, authorityPayload: {
        timeline,
        sourceRefs: sources.map((source) => authorityId("source", source.url)),
        sourceSnapshotRef: packageData.sourceSnapshotRef,
        sourceAuthorityArtifactRef: packageData.sourceAuthorityArtifactRef,
        sourceAuthorityPolicyVersion: SOURCE_AUTHORITY_POLICY_VERSION
      },
      authorityHash: hashValue(stableJson({ timeline, sources })), lifecycle: "ACTIVE", immutable: true, createdAt: now
    });
  }
  const timelineDoc = corpusCollection("platformReadModels").doc(`timeline--${ledger.data()!.slug}`);
  const priorTimelineProjection = await timelineDoc.get();
  const priorPayload = priorTimelineProjection.data()?.payload as { events?: Array<{ id?: number }> } | undefined;
  const activeEventIds = new Set(ids.eventIds);
  for (const priorEvent of priorPayload?.events || []) {
    if (typeof priorEvent.id !== "number" || activeEventIds.has(priorEvent.id)) continue;
    batch.set(corpusCollection("platformReadModels").doc(`milestone--${priorEvent.id}`), { lifecycle: "superseded", supersededByPublishedMemoryId: publishedMemoryId, updatedAt: now }, { merge: true });
    batch.set(corpusCollection("searchDocuments").doc(`milestone--${priorEvent.id}`), { published: false, supersededByPublishedMemoryId: publishedMemoryId, updatedAt: now }, { merge: true });
    batch.set(corpusCollection("sitemapDocuments").doc(`milestone--${priorEvent.id}`), { published: false, supersededByPublishedMemoryId: publishedMemoryId, updatedAt: projection.createdAt }, { merge: true });
  }
  batch.set(timelineDoc, {
    projectionType: "timeline", lifecycle: "active", slug: ledger.data()!.slug, publicId: ids.timelineId,
    categorySlug: slugifyTopic(timeline.category), tagSlugs: projection.tagRecords.map((tag) => tag.slug), payload: projection.detail,
    publishedMemoryId, projectionHash, sortTimestamp: now, authorityKeys: [`timeline:${ids.timelineId}`], updatedAt: now
  });
  projection.events.forEach((event) => {
    const eventHash = hashValue(stableJson(event));
    batch.set(corpusCollection("platformReadModels").doc(`milestone--${event.id}`), {
      projectionType: "milestone", lifecycle: "active", slug: slugifyTopic(event.title), publicId: event.id, payload: event,
      publishedMemoryId, projectionHash: eventHash, sortTimestamp: now, authorityKeys: [`milestone:${event.id}`, `timeline:${ids.timelineId}`], updatedAt: now
    });
    batch.set(corpusCollection("searchDocuments").doc(`milestone--${event.id}`), {
      type: "milestone", publicId: event.id, slug: slugifyTopic(event.title), title: event.title,
      searchableText: `${event.title} ${event.description} ${event.tags.map((tag) => tag.name).join(" ")}`,
      tokens: tokenize(`${event.title} ${event.description} ${event.tags.map((tag) => tag.name).join(" ")}`), payload: { type: "milestone", id: event.id, milestone: event },
      published: true, publishedMemoryId, updatedAt: now
    });
    batch.set(corpusCollection("sitemapDocuments").doc(`milestone--${event.id}`), { kind: "milestone", id: event.id, title: event.title, slug: slugifyTopic(event.title), updatedAt: projection.createdAt, published: true });
  });
  batch.set(corpusCollection("searchDocuments").doc(`timeline--${ids.timelineId}`), {
    type: "timeline", publicId: ids.timelineId, slug: ledger.data()!.slug, title: timeline.title,
    searchableText: `${timeline.title} ${timeline.description} ${timeline.tags.join(" ")}`,
    tokens: tokenize(`${timeline.title} ${timeline.description} ${timeline.tags.join(" ")}`), payload: { type: "timeline", id: ids.timelineId, timeline: timelineSummary(projection.detail) },
    published: true, publishedMemoryId, updatedAt: now
  });
  batch.set(corpusCollection("sitemapDocuments").doc(`timeline--${ids.timelineId}`), { kind: "timeline", id: ids.timelineId, title: timeline.title, slug: ledger.data()!.slug, updatedAt: projection.createdAt, published: true });
  if (payload.generation === 1) {
    batch.set(corpusCollection("categoryDocuments").doc(slugifyTopic(timeline.category)), {
      slug: slugifyTopic(timeline.category),
      name: timeline.category,
      count: FieldValue.increment(1),
      updatedAt: now
    }, { merge: true });
  }
  for (const tag of projection.tagRecords) batch.set(corpusCollection("tagDocuments").doc(tag.slug), { ...tag, updatedAt: now }, { merge: true });
  batch.set(corpusCollection("publicationLifecycle").doc(`active--${payload.topicId}`), {
    topicId: payload.topicId, publishedMemoryId, timelineId: ids.timelineId, slug: ledger.data()!.slug, generation: payload.generation,
    priorPublishedMemoryId: ledger.data()?.publishedMemoryId || null, lifecycle: "ACTIVE", projectionHash, updatedAt: now
  });
  batch.update(corpusCollection("topicLedgers").doc(payload.topicId), {
    state: "PUBLISHED", currentStage: "published", timelineId: ids.timelineId, publishedMemoryId, publishedAt: now,
    leaseOwner: null, leaseExpiresAt: null, lastError: null, updatedAt: now
  });
  batch.update(corpusCollection("generationJobs").doc(payload.jobId), { state: "PUBLISHED", currentStage: "published", completedAt: now, updatedAt: now });
  batch.create(corpusCollection("auditEvents").doc(randomUUID()), {
    institution: "published_memory", topicId: payload.topicId, jobId: payload.jobId, packageId: payload.packageId, admissionId,
    eventType: "PUBLICATION_COMPLETED", lineage: {
      decisionId, approvalId, publishedMemoryId, projectionHash,
      priorPublishedMemoryId: ledger.data()?.publishedMemoryId || null,
      sourceAuthorityArtifactRef: packageData.sourceAuthorityArtifactRef,
      sourceSnapshotRef: packageData.sourceSnapshotRef,
      sourceAuthorityPolicyVersion: SOURCE_AUTHORITY_POLICY_VERSION
    }, immutable: true, createdAt: now
  });
  await batch.commit();
  return { status: "PUBLISHED", topicId: payload.topicId, timelineId: ids.timelineId, route: `/timeline/${ledger.data()!.slug}` };
}
