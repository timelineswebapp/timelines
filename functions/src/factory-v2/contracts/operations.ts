import { z } from "zod";
import { boundedText, executionEnvelopeFields, hashSchema, httpsUrlSchema, idSchema, immutableEnvelopeFields, V2_PIPELINE_VERSION } from "./common";
import { researchBudgetSchema } from "./knowledge";

const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const researchTaskSchema = z.object({
  taskId: z.string().uuid(),
  corpusId: immutableEnvelopeFields.corpusId,
  topicId: idSchema,
  runId: idSchema,
  generation: z.number().int().positive(),
  scopeContractId: idSchema,
  researchMapId: idSchema,
  queryPlanId: idSchema,
  queryId: idSchema,
  state: z.enum(["QUEUED", "LEASED", "COMPLETED", "FAILED", "CANCELLED"]),
  priority: z.number().int().min(0).max(1000),
  deterministicDeliveryId: idSchema,
  leaseOwner: boundedText(2, 200).nullable(),
  leaseExpiresAt: z.string().datetime().nullable(),
  attemptCount: z.number().int().min(0).max(3),
  resultArtifactId: idSchema.nullable(),
  updatedAt: z.string().datetime()
}).strict();

export const acquisitionRunSchema = z.object({
  ...executionEnvelopeFields,
  acquisitionRunId: idSchema,
  queryPlanId: idSchema,
  queryId: idSchema,
  role: z.enum(["ORIENTATION", "PHASE_DIMENSION", "AUTHORITY_TARGETED", "SOURCE_RETRIEVAL"]),
  providerReportedQueries: z.array(boundedText(1, 500)).max(40),
  groundingChunkCount: z.number().int().nonnegative().max(100),
  groundingSupportCount: z.number().int().nonnegative().max(500),
  discoveredSourceIds: z.array(idSchema).max(60).refine(unique),
  resultState: z.enum(["ATTRIBUTABLE", "UNATTRIBUTABLE", "BUDGET_EXHAUSTED", "FAILED"]),
  budgetConsumed: researchBudgetSchema.partial(),
  modelExecutionId: idSchema.nullable()
}).strict();

export const acquisitionDiscoverySchema = z.object({
  ...executionEnvelopeFields,
  discoveryId: idSchema,
  acquisitionRunId: idSchema,
  queryId: idSchema,
  providerQuery: boundedText(3, 500),
  providerReportedQueries: z.array(boundedText(1, 500)).max(40),
  responseBodyHash: hashSchema,
  chunks: z.array(z.object({ chunkIndex: z.number().int().nonnegative().max(1000), url: httpsUrlSchema, title: boundedText(1, 500), domain: boundedText(1, 253).nullable() }).strict()).max(100),
  supports: z.array(z.object({ supportIndex: z.number().int().nonnegative().max(1000), startIndex: z.number().int().nonnegative().nullable(), endIndex: z.number().int().nonnegative().nullable(), attributedText: boundedText(1, 12_000), chunkIndices: z.array(z.number().int().nonnegative()).min(1).max(20) }).strict()).max(500),
  searchEntryPointPresent: z.boolean()
}).strict();

export const reconnaissanceRecordSchema = z.object({
  ...executionEnvelopeFields,
  reconnaissanceId: idSchema,
  scopeContractId: idSchema,
  knownEntityIds: z.array(idSchema).max(50).refine(unique),
  admittedEventVersionIds: z.array(idSchema).max(50).refine(unique),
  strongClaimVersionIds: z.array(idSchema).max(50).refine(unique),
  reusableSnapshotIds: z.array(idSchema).max(50).refine(unique),
  conflictSetIds: z.array(idSchema).max(50).refine(unique),
  gaps: z.array(boundedText(2, 240)).max(50),
  legacyInputsExcluded: z.literal(true)
}).strict();

export const topicOperationSchema = z.object({
  operationId: idSchema,
  corpusId: immutableEnvelopeFields.corpusId,
  topicId: idSchema,
  runId: idSchema,
  generation: z.number().int().positive(),
  pipelineVersion: z.enum(["factory-v2-a.12", V2_PIPELINE_VERSION]),
  executionMode: z.literal("SHADOW"),
  state: z.enum(["QUEUED", "RUNNING", "FAILED", "COMPLETED"]),
  stage: z.enum(["A1_SCHEMAS", "A2_SCOPE_ACQUISITION", "A3_CLAIMS", "A4_AUTHORITY_CONFLICTS", "A5_RESOLUTION_REUSE", "COMPLETE"]),
  scopeState: boundedText(2, 80), researchMapState: boundedText(2, 80), currentBlockingReason: boundedText(2, 1000).nullable(),
  counts: z.record(z.number().int().nonnegative()).refine((value) => Object.keys(value).length <= 50),
  budgetsConsumed: z.record(z.number().nonnegative()).refine((value) => Object.keys(value).length <= 20),
  elapsedMs: z.number().int().nonnegative().max(86_400_000),
  finalVerdict: z.enum(["PENDING", "PASS", "FAIL"]),
  updatedAt: z.string().datetime()
}).strict();

export const auditRecordSchema = z.object({
  ...executionEnvelopeFields,
  auditRecordId: idSchema,
  action: boundedText(2, 160),
  actorType: z.enum(["SERVICE", "MODEL", "POLICY", "HUMAN"]),
  actorId: boundedText(2, 240),
  artifactRefs: z.array(z.object({ collection: boundedText(2, 120), id: idSchema, payloadHash: hashSchema.nullable() }).strict()).max(100),
  details: z.record(z.union([z.string().max(1000), z.number(), z.boolean(), z.null()])).refine((value) => Object.keys(value).length <= 50)
}).strict();
