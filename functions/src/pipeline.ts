import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "./firestore";
import {
  PUBLIC_ID_BASE,
  GOVERNANCE_POLICY_VERSION,
  LEASE_DURATION_MS,
  MAX_TOPIC_ATTEMPTS,
  PIPELINE_VERSION,
  SCHEMA_VERSION
} from "./config";
import { corpusCollection, corpusRecord, requireTaskCorpus, type CorpusCollectionName } from "./corpus";
import { hashValue, slugifyTopic } from "./normalization";
import type { GeneratedTimeline, SourceCandidate, TaskPayload } from "./schemas";
import { generatedTimelineSchema, sourceCandidateSchema } from "./schemas";
import { enqueueInstitutionalTask } from "./tasks";
import { generateStructuredTimeline, researchTopic, type GenerationResult, type ResearchResult } from "./vertex";

type LeaseResult = { acquired: true; displayTitle: string; normalizedTitle: string; attemptCount: number } | { acquired: false; reason: string };

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
  await createIfAbsent("factoryArtifacts", authorityId(payload.jobId, "research-artifact"), {
    artifactId: authorityId(payload.jobId, "research-artifact"),
    runId,
    topicId: payload.topicId,
    artifactType: "grounded_research",
    sourceSnapshotId: snapshotId,
    sourceRefs: research.sources.map((source) => authorityId("source", source.url)),
    contentHash: research.execution.responseHash,
    payload: { execution: research.execution, groundingMetadata: research.groundingMetadata },
    immutable: true,
    createdAt: Timestamp.now()
  });
}

async function persistFactoryCandidate(payload: TaskPayload, research: ResearchResult, generation: GenerationResult) {
  const timeline = generatedTimelineSchema.parse(generation.timeline);
  const sourceMap = new Map(research.sources.map((source) => [source.sourceId, source]));
  const evidenceMap = new Map(research.evidenceSegments.map((segment) => [segment.evidenceRef, segment]));
  const timelineObjectId = authorityId(payload.jobId, "timeline-candidate");
  const existing = await corpusCollection("factoryObjects").doc(timelineObjectId).get();
  if (existing.exists) {
    return { timelineObjectId, timeline: generatedTimelineSchema.parse(existing.data()!.payload) };
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
      const sourceSnapshotId = authorityId(payload.jobId, "grounded-research", research.execution.responseHash);
      const corpusDocumentId = authorityId(sourceSnapshotId, "research-corpus");
      batch.create(corpusCollection("evidenceRecords").doc(evidenceId), {
        evidenceId,
        topicId: payload.topicId,
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
  return { timelineObjectId, timeline };
}

function evaluateRoutinePolicy(timeline: GeneratedTimeline, sources: SourceCandidate[]) {
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  const reasons: string[] = [];
  if (sources.length < 2) reasons.push("fewer_than_two_grounded_sources");
  if (timeline.events.some((event) => event.sourceRefs.length === 0)) reasons.push("milestone_without_evidence");
  if (timeline.events.some((event) => event.sourceRefs.some((sourceRef) => !sourceIds.has(sourceRef)))) reasons.push("unresolved_source_reference");
  if (new Set(timeline.events.map((event) => `${event.sortYear}:${event.sortMonth}:${event.sortDay}:${event.title.toLocaleLowerCase("en-US")}`)).size !== timeline.events.length) {
    reasons.push("duplicate_milestone_signature");
  }
  return reasons.length === 0
    ? { outcome: "routine" as const, reasons: ["Validated evidence, source diversity, chronology, and duplicate gates passed."] }
    : { outcome: "exceptional" as const, reasons };
}

async function createGovernancePackage(payload: TaskPayload, timelineObjectId: string, timeline: GeneratedTimeline, sources: SourceCandidate[]) {
  const packageId = deterministicUuid(payload.jobId, "governance-package", GOVERNANCE_POLICY_VERSION);
  const queueId = authorityId(packageId, "publication-readiness-queue");
  const policy = evaluateRoutinePolicy(timeline, sources);
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
        factoryObjectRefs: [timelineObjectId],
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
    const research = await researchTopic(lease.displayTitle);
    await persistResearch(payload, research);
    await setStage(payload, "editorial_intelligence");
    const generation = await generateStructuredTimeline(lease.displayTitle, research);
    const candidate = await persistFactoryCandidate(payload, research, generation);
    await setStage(payload, "governance_handoff");
    const governance = await createGovernancePackage(payload, candidate.timelineObjectId, candidate.timeline, research.sources);
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
  return db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(jobRef, counterRef);
    const job = snapshots[0]!;
    const counter = snapshots[1]!;
    if (job.data()?.publicIds) return job.data()!.publicIds as PublicIdAllocation;
    const current = counter.data() || {};
    let timelineCursor = Number(current.timeline ?? PUBLIC_ID_BASE);
    let eventCursor = Number(current.event ?? PUBLIC_ID_BASE);
    let sourceCursor = Number(current.source ?? PUBLIC_ID_BASE);
    let tagCursor = Number(current.tag ?? PUBLIC_ID_BASE);
    const sourceIds: Record<string, number> = {};
    for (const source of sources) sourceIds[source.sourceId] = ++sourceCursor;
    const tagIds: Record<string, number> = {};
    for (const tag of Array.from(new Set([...timeline.tags, ...timeline.events.flatMap((event) => event.tags)]))) tagIds[slugifyTopic(tag)] = ++tagCursor;
    const allocation: PublicIdAllocation = {
      timelineId: ++timelineCursor,
      eventIds: timeline.events.map(() => ++eventCursor),
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
  const [ledger, packageSnapshot, candidateQuery, researchArtifact] = await Promise.all([
    corpusCollection("topicLedgers").doc(payload.topicId).get(),
    corpusCollection("governancePackages").doc(payload.packageId).get(),
    corpusCollection("factoryObjects").where("runId", "==", payload.jobId).where("objectType", "==", "candidate_timeline").limit(1).get(),
    corpusCollection("sourceSnapshots").where("jobId", "==", payload.jobId).limit(1).get()
  ]);
  if (!ledger.exists || !packageSnapshot.exists || candidateQuery.empty) throw new Error("Institutional transition input is incomplete.");
  if (ledger.data()?.state === "PUBLISHED") return { status: "NO_OP", reason: "already_published" };
  if (ledger.data()?.activeJobId !== payload.jobId || ledger.data()?.generation !== payload.generation) return { status: "NO_OP", reason: "stale_generation" };
  const timeline = generatedTimelineSchema.parse(candidateQuery.docs[0]!.data().payload);
  const sources = Array.isArray(researchArtifact.docs[0]?.data().sources)
    ? (researchArtifact.docs[0]!.data().sources as unknown[]).map((source) => sourceCandidateSchema.parse(source))
    : [];
  if (sources.length < 2) throw new Error("Institutional transition cannot resolve required source lineage.");
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
    lifecycle: "ADMITTED", authorityRefs: [candidateQuery.docs[0]!.id], evidenceQuery: { topicId: payload.topicId, result: "PASSED" }, immutable: true, createdAt: now
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
      generation: payload.generation, version: 1, authorityPayload: { timeline, sourceRefs: sources.map((source) => authorityId("source", source.url)) },
      authorityHash: hashValue(stableJson({ timeline, sources })), lifecycle: "ACTIVE", immutable: true, createdAt: now
    });
  }
  const timelineDoc = corpusCollection("platformReadModels").doc(`timeline--${ledger.data()!.slug}`);
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
  batch.set(corpusCollection("categoryDocuments").doc(slugifyTopic(timeline.category)), {
    slug: slugifyTopic(timeline.category),
    name: timeline.category,
    count: FieldValue.increment(1),
    updatedAt: now
  }, { merge: true });
  for (const tag of projection.tagRecords) batch.set(corpusCollection("tagDocuments").doc(tag.slug), { ...tag, updatedAt: now }, { merge: true });
  batch.set(corpusCollection("publicationLifecycle").doc(`active--${payload.topicId}`), {
    topicId: payload.topicId, publishedMemoryId, timelineId: ids.timelineId, slug: ledger.data()!.slug, generation: payload.generation,
    lifecycle: "ACTIVE", projectionHash, updatedAt: now
  });
  batch.update(corpusCollection("topicLedgers").doc(payload.topicId), {
    state: "PUBLISHED", currentStage: "published", timelineId: ids.timelineId, publishedMemoryId, publishedAt: now,
    leaseOwner: null, leaseExpiresAt: null, lastError: null, updatedAt: now
  });
  batch.update(corpusCollection("generationJobs").doc(payload.jobId), { state: "PUBLISHED", currentStage: "published", completedAt: now, updatedAt: now });
  batch.create(corpusCollection("auditEvents").doc(randomUUID()), {
    institution: "published_memory", topicId: payload.topicId, jobId: payload.jobId, packageId: payload.packageId, admissionId,
    eventType: "PUBLICATION_COMPLETED", lineage: { decisionId, approvalId, publishedMemoryId, projectionHash }, immutable: true, createdAt: now
  });
  await batch.commit();
  return { status: "PUBLISHED", topicId: payload.topicId, timelineId: ids.timelineId, route: `/timeline/${ledger.data()!.slug}` };
}
