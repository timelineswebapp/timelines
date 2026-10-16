import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./firestore";
import { ACTIVE_CORPUS_ID, MAX_REQUESTS_PER_IP_PER_DAY, MAX_TOPIC_ATTEMPTS } from "./config";
import { corpusCollection, corpusRecord } from "./corpus";
import { hashValue, normalizeTopic } from "./normalization";
import { evidenceFirstTaskPayloadSchema, taskPayloadSchema, type TopicRequestInput, type TaskPayload } from "./schemas";
import { enqueueGenerationTask } from "./tasks";

export type TopicState =
  | "NEW"
  | "QUEUED"
  | "PROCESSING"
  | "AWAITING_REVIEW"
  | "SHADOW_COMPLETED"
  | "PUBLISHED"
  | "RETRY_SCHEDULED"
  | "FAILED"
  | "CANCELLED";

const ACTIVE_STATES = new Set<TopicState>(["NEW", "QUEUED", "PROCESSING", "AWAITING_REVIEW", "SHADOW_COMPLETED", "RETRY_SCHEDULED"]);
const ENQUEUE_RETRY_DELAY_MS = 60_000;

type RetryDeferredEnqueueDependencies = {
  enqueueGenerationTask: typeof enqueueGenerationTask;
};

function requireIpSalt() {
  const salt = process.env.IP_HASH_SALT;
  if (!salt || salt.length < 32) throw new Error("IP_HASH_SALT is not configured securely.");
  return salt;
}

function publicTimelineDocumentId(slug: string) {
  return `timeline--${slug}`;
}

function requestFields(input: TopicRequestInput) {
  return {
    email: "email" in input ? input.email : null,
    message: "message" in input ? input.message : null,
    targetTimeline: "targetTimeline" in input ? input.targetTimeline : null,
    sourcesScope: "sourcesScope" in input ? input.sourcesScope : null
  };
}

function rateLimitIdentity(ip: string) {
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = hashValue(`${requireIpSalt()}:${ip}`);
  return { day, ipHash, rateLimitRef: corpusCollection("rateLimits").doc(`${day}--${ipHash}`) };
}

function enforceAndIncrementRateLimit(
  transaction: FirebaseFirestore.Transaction,
  rateLimitRef: FirebaseFirestore.DocumentReference,
  rateLimit: FirebaseFirestore.DocumentSnapshot,
  day: string,
  now: Timestamp
) {
  const requestCount = Number(rateLimit.data()?.count || 0);
  if (requestCount >= MAX_REQUESTS_PER_IP_PER_DAY) {
    const error = new Error("Daily request limit exceeded for this IP.");
    error.name = "RateLimitExceeded";
    throw error;
  }
  transaction.set(rateLimitRef, { count: requestCount + 1, day, updatedAt: now }, { merge: true });
}

export async function captureVisitorRequest(input: Exclude<TopicRequestInput, { requestType: "timeline_request" }>, ip: string) {
  const normalized = normalizeTopic(input.query, input.language, ACTIVE_CORPUS_ID);
  const { day, ipHash, rateLimitRef } = rateLimitIdentity(ip);
  const requestRef = corpusCollection("adminOperations").doc(randomUUID());
  const now = Timestamp.now();
  await db.runTransaction(async (transaction) => {
    const rateLimit = await transaction.get(rateLimitRef);
    enforceAndIncrementRateLimit(transaction, rateLimitRef, rateLimit, day, now);
    transaction.create(requestRef, corpusRecord({
      operationType: "visitor_request",
      requestId: requestRef.id,
      query: input.query,
      normalizedQuery: normalized.normalizedTitle,
      topicId: normalized.topicId,
      ipHash,
      language: input.language,
      requestType: input.requestType,
      ...requestFields(input),
      metadata: input.metadata,
      status: "pending",
      createdAt: now
    }));
  });
  return { status: "CAPTURED" as const, requestId: requestRef.id, topicId: normalized.topicId };
}

export async function intakeTopic(input: TopicRequestInput, ip: string) {
  if (input.requestType !== "timeline_request") throw new Error("Only timeline requests may enter the generation ledger.");
  const normalized = normalizeTopic(input.query, input.language, ACTIVE_CORPUS_ID);
  const { day, ipHash, rateLimitRef } = rateLimitIdentity(ip);
  const ledgerRef = corpusCollection("topicLedgers").doc(normalized.topicId);
  const publishedRef = corpusCollection("platformReadModels").doc(publicTimelineDocumentId(normalized.slug));
  const requestRef = corpusCollection("adminOperations").doc(randomUUID());
  const now = Timestamp.now();

  const result = await db.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(rateLimitRef, ledgerRef, publishedRef);
    const rateLimit = snapshots[0]!;
    const ledger = snapshots[1]!;
    const published = snapshots[2]!;
    enforceAndIncrementRateLimit(transaction, rateLimitRef, rateLimit, day, now);
    transaction.create(requestRef, corpusRecord({
      operationType: "timeline_request",
      requestId: requestRef.id,
      query: input.query,
      normalizedQuery: normalized.normalizedTitle,
      topicId: normalized.topicId,
      ipHash,
      language: input.language,
      requestType: input.requestType,
      ...requestFields(input),
      metadata: input.metadata,
      createdAt: now
    }));

    if (published.exists) {
      const payload = published.data()?.payload as { slug?: string } | undefined;
      return { response: { status: "AVAILABLE" as const, topicId: normalized.topicId, route: `/timeline/${payload?.slug || normalized.slug}` }, task: null };
    }

    if (ledger.exists) {
      const data = ledger.data() as { state?: TopicState; timelineId?: number; slug?: string; activeJobId?: string; generation?: number };
      if (data.state === "PUBLISHED") {
        return { response: { status: "AVAILABLE" as const, topicId: normalized.topicId, route: `/timeline/${data.slug || normalized.slug}`, timelineId: data.timelineId }, task: null };
      }
      if (data.state === "FAILED" || data.state === "CANCELLED") {
        return { response: { status: "FAILED" as const, topicId: normalized.topicId }, task: null };
      }
      if (data.state && ACTIVE_STATES.has(data.state)) {
        return { response: { status: "PROCESSING" as const, topicId: normalized.topicId, state: data.state }, task: null };
      }
    }

    const jobId = randomUUID();
    const generation = 1;
    const task: TaskPayload = { corpusId: ACTIVE_CORPUS_ID, topicId: normalized.topicId, jobId, generation, origin: "user" };
    transaction.create(ledgerRef, corpusRecord({
      ...normalized,
      origin: "user",
      priority: 1000,
      state: "QUEUED",
      currentStage: "queued",
      timelineId: null,
      activeJobId: jobId,
      deterministicTaskIdentity: `${ACTIVE_CORPUS_ID}-${normalized.topicId}-g${generation}`,
      leaseOwner: null,
      leaseExpiresAt: null,
      attemptCount: 0,
      maximumAttempts: MAX_TOPIC_ATTEMPTS,
      nextRetryAt: null,
      lastError: null,
      generation,
      createdAt: now,
      updatedAt: now,
      publishedAt: null
    }));
    transaction.create(corpusCollection("generationJobs").doc(jobId), corpusRecord({
      jobId,
      topicId: normalized.topicId,
      generation,
      origin: "user",
      priority: 1000,
      state: "QUEUED",
      currentStage: "queued",
      attemptCount: 0,
      maximumAttempts: MAX_TOPIC_ATTEMPTS,
      createdAt: now,
      updatedAt: now
    }));
    return { response: { status: "QUEUED" as const, topicId: normalized.topicId, state: "QUEUED" as const }, task };
  });

  if (result.task) {
    try {
      await enqueueGenerationTask(result.task, true);
    } catch (error) {
      const nextRetryAt = Timestamp.fromMillis(Date.now() + 60_000);
      const message = error instanceof Error ? error.message : String(error);
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(ledgerRef);
        if (current.data()?.activeJobId !== result.task?.jobId) return;
        transaction.update(ledgerRef, { state: "RETRY_SCHEDULED", nextRetryAt, lastError: message.slice(0, 2000), updatedAt: Timestamp.now() });
        transaction.update(corpusCollection("generationJobs").doc(result.task!.jobId), { state: "RETRY_SCHEDULED", nextRetryAt, lastError: message.slice(0, 2000), updatedAt: Timestamp.now() });
        transaction.create(corpusCollection("failureRecords").doc(randomUUID()), {
          topicId: normalized.topicId,
          jobId: result.task!.jobId,
          stage: "enqueue",
          retryable: true,
          message: message.slice(0, 2000),
          createdAt: Timestamp.now()
        });
      });
      throw error;
    }
  }
  return result.response;
}

export async function claimAutonomousTopic(title: string, significance: string, relevanceScore: number) {
  const normalized = normalizeTopic(title, "en", ACTIVE_CORPUS_ID);
  const ledgerRef = corpusCollection("topicLedgers").doc(normalized.topicId);
  const now = Timestamp.now();
  const result = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ledgerRef);
    if (current.exists) return null;
    const jobId = randomUUID();
    const task: TaskPayload = { corpusId: ACTIVE_CORPUS_ID, topicId: normalized.topicId, jobId, generation: 1, origin: "autonomous" };
    transaction.create(ledgerRef, corpusRecord({
      ...normalized,
      origin: "autonomous",
      priority: 100,
      discoverySignificance: significance,
      discoveryRelevanceScore: relevanceScore,
      state: "QUEUED",
      currentStage: "queued",
      timelineId: null,
      activeJobId: jobId,
      deterministicTaskIdentity: `${ACTIVE_CORPUS_ID}-${normalized.topicId}-g1`,
      leaseOwner: null,
      leaseExpiresAt: null,
      attemptCount: 0,
      maximumAttempts: MAX_TOPIC_ATTEMPTS,
      nextRetryAt: null,
      lastError: null,
      generation: 1,
      createdAt: now,
      updatedAt: now,
      publishedAt: null
    }));
    transaction.create(corpusCollection("generationJobs").doc(jobId), corpusRecord({
      jobId,
      topicId: normalized.topicId,
      generation: 1,
      origin: "autonomous",
      priority: 100,
      state: "QUEUED",
      currentStage: "queued",
      attemptCount: 0,
      maximumAttempts: MAX_TOPIC_ATTEMPTS,
      createdAt: now,
      updatedAt: now
    }));
    return task;
  });
  if (!result) return null;
  try {
    await enqueueGenerationTask(result, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(ledgerRef);
      if (current.data()?.activeJobId !== result.jobId) return;
      const nextRetryAt = Timestamp.fromMillis(Date.now() + 60_000);
      transaction.update(ledgerRef, { state: "RETRY_SCHEDULED", nextRetryAt, lastError: message.slice(0, 2000), updatedAt: Timestamp.now() });
      transaction.update(corpusCollection("generationJobs").doc(result.jobId), { state: "RETRY_SCHEDULED", nextRetryAt, lastError: message.slice(0, 2000), updatedAt: Timestamp.now() });
      transaction.create(corpusCollection("failureRecords").doc(randomUUID()), {
        topicId: normalized.topicId,
        jobId: result.jobId,
        stage: "enqueue",
        retryable: true,
        message: message.slice(0, 2000),
        createdAt: Timestamp.now()
      });
    });
    throw error;
  }
  return result;
}

export async function retryDeferredEnqueues(limit = 50) {
  return retryDeferredEnqueuesWithDependencies(limit, { enqueueGenerationTask });
}

/**
 * Drains a bounded retry batch without allowing one transient Cloud Tasks failure
 * to strand later ready topics. This is deliberately limited to legacy generation
 * queue retries; deferred V2 re-entry remains a separately governed, unactivated
 * workflow.
 */
export async function retryDeferredEnqueuesWithDependencies(
  limit = 50,
  dependencies: RetryDeferredEnqueueDependencies
) {
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const snapshot = await corpusCollection("topicLedgers")
    .where("state", "==", "RETRY_SCHEDULED")
    .where("nextRetryAt", "<=", Timestamp.now())
    .orderBy("nextRetryAt", "asc")
    .limit(boundedLimit)
    .get();
  let requeued = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    try {
      if (typeof data.activeJobId !== "string" || !Number.isInteger(data.generation) || data.generation < 1) {
        throw new Error("Retry-scheduled ledger entry is missing a valid active job identity or generation.");
      }
      const rawPayload = {
        corpusId: ACTIVE_CORPUS_ID,
        topicId: document.id,
        jobId: data.activeJobId,
        generation: data.generation,
        origin: "retry" as const,
        ...(typeof data.generationReleaseId === "string" ? { generationReleaseId: data.generationReleaseId } : {})
      };
      const payload = "generationReleaseId" in rawPayload ? evidenceFirstTaskPayloadSchema.parse(rawPayload) : taskPayloadSchema.parse(rawPayload);
      await dependencies.enqueueGenerationTask(payload, data.origin !== "autonomous");
      const queued = await db.runTransaction(async (transaction) => {
        const current = await transaction.get(document.ref);
        if (current.data()?.state !== "RETRY_SCHEDULED" || current.data()?.activeJobId !== data.activeJobId) return false;
        const jobRef = corpusCollection("generationJobs").doc(data.activeJobId);
        const job = await transaction.get(jobRef);
        transaction.update(document.ref, { state: "QUEUED", currentStage: "queued", nextRetryAt: null, lastError: null, updatedAt: Timestamp.now() });
        if (job.exists) transaction.update(jobRef, { state: "QUEUED", currentStage: "queued", nextRetryAt: null, lastError: null, updatedAt: Timestamp.now() });
        return true;
      });
      if (queued) requeued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextRetryAt = Timestamp.fromMillis(Date.now() + ENQUEUE_RETRY_DELAY_MS);
      try {
        await db.runTransaction(async (transaction) => {
          const current = await transaction.get(document.ref);
          if (current.data()?.state !== "RETRY_SCHEDULED" || current.data()?.activeJobId !== data.activeJobId) return;
          const jobRef = typeof data.activeJobId === "string" ? corpusCollection("generationJobs").doc(data.activeJobId) : null;
          const job = jobRef ? await transaction.get(jobRef) : null;
          transaction.update(document.ref, { nextRetryAt, lastError: message.slice(0, 2000), updatedAt: Timestamp.now() });
          if (jobRef && job?.exists) transaction.update(jobRef, { state: "RETRY_SCHEDULED", nextRetryAt, lastError: message.slice(0, 2000), updatedAt: Timestamp.now() });
        });
      } catch (persistenceError) {
        console.error(JSON.stringify({ severity: "ERROR", component: "deferred_enqueue_retry", action: "retry_failure_persistence_failed", topicId: document.id, message: persistenceError instanceof Error ? persistenceError.message : String(persistenceError) }));
      }
      console.warn(JSON.stringify({ severity: "WARNING", component: "deferred_enqueue_retry", action: "retry_deferred_without_blocking_batch", topicId: document.id, message: message.slice(0, 2000) }));
    }
  }
  return requeued;
}
