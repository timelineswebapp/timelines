import { serverlessBackendClient } from "@/src/server/serverless/backend-client";
import { ApiError } from "@/src/server/api/responses";
import { z } from "zod";

const boundedId = z.string().min(1).max(160);
const timestamp = z.string().datetime();
const deferredTopicSchema = z.object({
  topicId: boundedId, runId: boundedId, generation: z.number().int().positive(), stage: z.string().min(1).max(160), updatedAt: timestamp, terminalFailureRecordId: boundedId.nullable(),
  outcome: z.object({ classification: z.enum(["PUBLIC_EVIDENCE_LIMITATION", "RESEARCH_BUDGET_EXHAUSTED"]), reentryState: z.enum(["REQUIRES_RELEVANT_CHANGE", "REQUIRES_AUTHORIZED_RETRY"]), detailedReason: z.string().min(1).max(240) }).strict(),
  operationalFeasibility: z.object({ state: z.literal("REENTRY_CONDITION_REQUIRED"), requiredCondition: z.enum(["RELEVANT_EVIDENCE_CHANGE", "AUTHORIZED_RETRY"]), terminalAt: timestamp, attemptsConsumed: z.number().int().nonnegative(), budgetConsumed: z.record(z.string().min(1).max(120), z.number().finite().nonnegative()), failureClass: z.string().min(1).max(160) }).strict(),
  reentryRequests: z.array(z.object({ requestId: boundedId, trigger: z.enum(["RELEVANT_EVIDENCE_CHANGE", "AUTHORIZED_RETRY"]), requestedAt: timestamp, state: z.enum(["REQUESTED", "CONSUMED"]), consumedAt: timestamp.nullable(), queuedRunId: boundedId.nullable() }).strict()).max(5)
}).strict();
const reentryResultSchema = z.object({ state: z.enum(["CREATED", "IDEMPOTENT"]), requestId: boundedId }).strict();
const sourceSubmissionResultSchema = z.object({ state: z.enum(["CREATED", "IDEMPOTENT"]), candidateId: boundedId }).strict();
const sourceSubmissionSchema = z.object({ candidateId: boundedId, operationId: boundedId, submittedUrl: z.string().url().max(2_048), rationale: z.string().min(3).max(1_000), submittedBy: z.string().min(2).max(240), createdAt: timestamp, state: z.literal("CANDIDATE") }).strict();
const sourceSubmissionInspectionSchema = z.object({ candidateId: boundedId, state: z.literal("CANDIDATE"), submittedAt: timestamp, validation: z.object({ state: z.literal("AUTHORITY_ELIGIBLE"), recordedAt: timestamp }).strict().nullable(), retrieval: z.object({ state: z.enum(["RETRIEVED_UNQUALIFIED", "RETRIEVAL_REJECTED"]), recordedAt: timestamp, retrievalDisposition: z.enum(["NEWLY_RETRIEVED", "CACHE_REUSED", "REVALIDATED", "ACCESS_LIMITED", "UNAVAILABLE"]).nullable(), rejectionCode: z.string().min(1).max(160).nullable() }).strict().nullable(), qualifyingEvidence: z.literal(false), reentryAuthorized: z.literal(false) }).strict();
const generationRetryQueueItemSchema = z.object({ topicId: boundedId, jobId: boundedId, generation: z.number().int().positive(), origin: z.enum(["user", "autonomous"]), state: z.literal("RETRY_SCHEDULED"), nextRetryAt: timestamp, updatedAt: timestamp, lastErrorPresent: z.boolean(), enqueueRetryCount: z.number().int().nonnegative() }).strict();
const generationRetryQueueHealthSchema = z.object({ scheduledCount: z.number().int().nonnegative(), dueCount: z.number().int().nonnegative(), oldestDueAt: timestamp.nullable() }).strict();
const generationEnqueueFailureItemSchema = z.object({ topicId: boundedId, jobId: boundedId, generation: z.number().int().positive(), origin: z.enum(["user", "autonomous"]), state: z.literal("FAILED"), failedAt: timestamp, enqueueRetryCount: z.number().int().nonnegative(), lastErrorPresent: z.boolean() }).strict();

function responseShape(value: unknown) {
  if (Array.isArray(value)) return { type: "array", length: value.length };
  if (value === null) return { type: "null" };
  if (typeof value === "object") return { type: "object", keys: Object.keys(value as Record<string, unknown>).sort().slice(0, 20) };
  return { type: typeof value };
}

function parseBridgeDto<T>(operation: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    console.error(JSON.stringify({
      level: "error",
      component: "factory_v2_admin_service",
      event: "factory_v2_bridge_dto_invalid",
      operation,
      response: responseShape(value),
      issues: result.error.issues.slice(0, 10).map((issue) => ({ code: issue.code, path: issue.path.map(String) }))
    }));
    throw new ApiError(502, "SERVERLESS_BACKEND_INVALID_RESPONSE", "Factory operational data is temporarily unavailable.");
  }
  return result.data;
}

export type DeferredFactoryV2Topic = z.infer<typeof deferredTopicSchema>;

export type DeferredFactoryV2ReentryResult = z.infer<typeof reentryResultSchema>;
export type FactoryV2SourceSubmissionResult = z.infer<typeof sourceSubmissionResultSchema>;
export type FactoryV2SourceSubmission = z.infer<typeof sourceSubmissionSchema>;
export type FactoryV2SourceSubmissionInspection = z.infer<typeof sourceSubmissionInspectionSchema>;
export type GenerationRetryQueueItem = z.infer<typeof generationRetryQueueItemSchema>;
export type GenerationRetryQueueHealth = z.infer<typeof generationRetryQueueHealthSchema>;
export type GenerationEnqueueFailureItem = z.infer<typeof generationEnqueueFailureItemSchema>;

export const factoryV2AdminService = {
  async listDeferredTopics(limit = 25) { return parseBridgeDto("list_deferred_topics", z.array(deferredTopicSchema).max(100), await serverlessBackendClient.listDeferredFactoryV2Topics<unknown>(limit)); },
  async listGenerationRetryQueue(limit = 25) { return parseBridgeDto("list_generation_retry_queue", z.array(generationRetryQueueItemSchema).max(100), await serverlessBackendClient.listGenerationRetryQueue<unknown>(limit)); },
  async getGenerationRetryQueueHealth() { return parseBridgeDto("get_generation_retry_queue_health", generationRetryQueueHealthSchema, await serverlessBackendClient.getGenerationRetryQueueHealth<unknown>()); },
  async listGenerationEnqueueFailures(limit = 25) { return parseBridgeDto("list_generation_enqueue_failures", z.array(generationEnqueueFailureItemSchema).max(100), await serverlessBackendClient.listGenerationEnqueueFailures<unknown>(limit)); },
  async createDeferredReentry(input: { operationId: string; trigger: "RELEVANT_EVIDENCE_CHANGE" | "AUTHORIZED_RETRY"; relevantChangeArtifactId: string | null; authorizedBy: string | null; authorizationReason: string | null }) { return parseBridgeDto("create_deferred_reentry", reentryResultSchema, await serverlessBackendClient.createDeferredFactoryV2Reentry<unknown>(input)); },
  async createSourceSubmission(input: { operationId: string; submittedUrl: string; rationale: string; submittedBy: string }) { return parseBridgeDto("create_source_submission", sourceSubmissionResultSchema, await serverlessBackendClient.createFactoryV2SourceSubmission<unknown>(input)); },
  async listSourceSubmissions(limit = 25) { return parseBridgeDto("list_source_submissions", z.array(sourceSubmissionSchema).max(100), await serverlessBackendClient.listFactoryV2SourceSubmissions<unknown>(limit)); },
  async getSourceSubmissionInspection(candidateId: string) { return parseBridgeDto("get_source_submission_inspection", sourceSubmissionInspectionSchema, await serverlessBackendClient.getFactoryV2SourceSubmissionInspection<unknown>(candidateId)); }
};
