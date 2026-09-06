import { z } from "zod";
import { boundedText, hashSchema, idSchema, immutableEnvelopeFields, V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION, V2_LEGACY_SCHEMA_VERSION, V2_PIPELINE_VERSION, V2_SCHEMA_VERSION } from "./common";

const unique = <T>(values: T[]) => new Set(values).size === values.length;
const ids = (maximum = 200) => z.array(idSchema).max(maximum).refine(unique, "IDs must be unique.");

export const knowledgeCoverageStateSchema = z.enum(["SUFFICIENT", "WEAK", "MISSING", "NOT_APPLICABLE", "BLOCKED"]);
export const knowledgeCoverageCellSchema = z.object({
  cellId: idSchema,
  kind: z.enum(["PHASE", "DIMENSION", "QUESTION"]),
  lockedRefId: idSchema,
  label: boundedText(2, 700),
  state: knowledgeCoverageStateSchema,
  material: z.boolean(),
  supportingClaimVersionIds: ids(300),
  chronologyEligibleEventVersionIds: ids(200),
  conflictSetIds: ids(100),
  reasonCodes: z.array(z.enum([
    "AUTHORITATIVE_EVENT_KNOWLEDGE_PRESENT",
    "SUPPORTED_NON_EVENT_KNOWLEDGE_ONLY",
    "EXTRACTED_KNOWLEDGE_NOT_AUTHORITATIVE",
    "NO_RELEVANT_KNOWLEDGE",
    "UNRESOLVED_MATERIAL_CONFLICT",
    "LOCKED_CELL_NOT_REQUIRED"
  ])).min(1).max(8).refine(unique)
}).strict();

export const knowledgeCoverageGapSchema = z.object({
  gapId: idSchema,
  code: z.enum([
    "MISSING_PHASE_KNOWLEDGE",
    "WEAK_PHASE_KNOWLEDGE",
    "MISSING_DIMENSION_KNOWLEDGE",
    "WEAK_DIMENSION_KNOWLEDGE",
    "MISSING_CHRONOLOGY",
    "STALE_ONGOING_SCOPE",
    "UNANSWERED_CRITICAL_RESEARCH_QUESTION",
    "MATERIAL_CONFLICT_BLOCKS_COVERAGE"
  ]),
  phaseIds: ids(24),
  dimensionIds: ids(20),
  questionIds: ids(120),
  existingSupportingClaimVersionIds: ids(300),
  reason: boundedText(10, 1200)
}).strict();

export const knowledgeCoverageAuditSchema = z.object({
  ...immutableEnvelopeFields,
  coverageAuditId: idSchema,
  auditStage: z.enum(["INITIAL", "FINAL"]),
  scopeContractId: idSchema,
  scopePayloadHash: hashSchema,
  researchMapId: idSchema,
  researchMapPayloadHash: hashSchema,
  sourceKnowledgeRunIds: ids(8),
  candidateEventVersionIds: ids(400),
  cells: z.array(knowledgeCoverageCellSchema).min(1).max(200),
  gaps: z.array(knowledgeCoverageGapSchema).max(200),
  latestChronologyEventYear: z.number().int().min(-10000).max(3000).nullable(),
  latestDurableSourceSnapshotAt: z.string().datetime().nullable(),
  ongoingFreshness: z.enum(["CURRENT_LOCKED_PHASE_REPRESENTED", "STALE_LOCKED_PHASE", "NOT_APPLICABLE"]),
  verdict: z.enum(["SUFFICIENT", "KNOWLEDGE_COVERAGE_INSUFFICIENT"]),
  auditMs: z.number().int().nonnegative().nullable()
}).strict();

export const completionBudgetSchema = z.object({
  maximumRounds: z.literal(1),
  maximumGapQuestions: z.number().int().min(1).max(5),
  maximumGroundingCalls: z.number().int().min(1).max(5),
  maximumProviderQueries: z.number().int().min(1).max(25),
  maximumSourceDocuments: z.number().int().min(1).max(30),
  maximumClaimExtractions: z.number().int().min(1).max(5),
  maximumAtomicClaims: z.number().int().min(1).max(100),
  maximumWorkerSeconds: z.number().int().min(60).max(480)
}).strict();

export const knowledgeCompletionTaskSchema = z.object({
  taskId: idSchema,
  gapIds: ids(20),
  phaseIds: ids(24),
  dimensionIds: ids(20),
  questionIds: ids(120),
  questionId: idSchema,
  question: boundedText(10, 900),
  providerQuery: boundedText(3, 500),
  intendedSourceClass: z.enum(["PRIMARY_INSTITUTIONAL", "SCHOLARLY_SECONDARY", "EDITED_REFERENCE", "ESTABLISHED_JOURNALISM"]),
  state: z.enum(["PLANNED", "COMPLETED", "FAILED", "BUDGET_EXHAUSTED"])
}).strict();

export const knowledgeCompletionPlanSchema = z.object({
  ...immutableEnvelopeFields,
  completionPlanId: idSchema,
  parentCoverageAuditId: idSchema,
  originalScopeContractId: idSchema,
  originalResearchMapId: idSchema,
  originalKnowledgeRunId: idSchema.nullable(),
  round: z.literal(1),
  budget: completionBudgetSchema,
  tasks: z.array(knowledgeCompletionTaskSchema).min(1).max(5),
  unplannedMaterialGapIds: ids(200)
}).strict();

const legacyKnowledgeCompletionResultSchema = z.object({
  ...immutableEnvelopeFields,
  schemaVersion: z.enum([V2_LEGACY_SCHEMA_VERSION, V2_SCHEMA_VERSION]),
  completionResultId: idSchema,
  completionPlanId: idSchema,
  initialCoverageAuditId: idSchema,
  finalCoverageAuditId: idSchema,
  acquisitionRunId: idSchema.nullable(),
  originalKnowledgeRunId: idSchema.nullable(),
  newClaimVersionIds: ids(100),
  newEventVersionIds: ids(100),
  reusedEventVersionIds: ids(100),
  unresolvedGapIds: ids(200),
  budgetConsumed: z.object({
    rounds: z.literal(1), groundingCalls: z.number().int().nonnegative().max(5), providerQueries: z.number().int().nonnegative().max(25),
    sourceDocuments: z.number().int().nonnegative().max(30), claimExtractions: z.number().int().nonnegative().max(5), atomicClaims: z.number().int().nonnegative().max(100), writes: z.number().int().nonnegative()
  }).strict().nullable(),
  timings: z.object({ initialKnowledgeReuseMs: z.number().int().nonnegative(), coverageAuditMs: z.number().int().nonnegative(), gapAcquisitionMs: z.number().int().nonnegative(), reAuditMs: z.number().int().nonnegative() }).strict().nullable(),
  finalVerdict: z.enum(["SUFFICIENT", "KNOWLEDGE_COVERAGE_INSUFFICIENT"])
}).strict();

/** The completed knowledge set is a Factory technical authority boundary. It
 * identifies one exact, coverage-certified semantic knowledge universe; it is
 * not Historical Library, Governance, Published Memory, or public authority. */
export const completedKnowledgeSetSchema = z.object({
  ...immutableEnvelopeFields,
  schemaVersion: z.literal(V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION),
  completionResultId: idSchema,
  completedKnowledgeSetId: idSchema,
  knowledgePipelineVersion: z.literal(V2_PIPELINE_VERSION),
  completionPlanId: idSchema,
  initialCoverageAuditId: idSchema,
  initialCoverageAuditPayloadHash: hashSchema,
  finalCoverageAuditId: idSchema,
  finalCoverageAuditPayloadHash: hashSchema,
  scopeContractId: idSchema,
  scopePayloadHash: hashSchema,
  researchMapId: idSchema,
  researchMapPayloadHash: hashSchema,
  candidateEventVersionIds: ids(400),
  candidateClaimVersionIds: ids(600),
  authorityVerdictIds: ids(600),
  conflictSetIds: ids(200),
  unresolvedGapIds: ids(200),
  finalVerdict: z.enum(["SUFFICIENT", "KNOWLEDGE_COVERAGE_INSUFFICIENT"])
}).strict().superRefine((set, context) => {
  if (set.artifactId !== set.completedKnowledgeSetId || set.completionResultId !== set.completedKnowledgeSetId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["completedKnowledgeSetId"], message: "Completed knowledge-set identities must match the immutable artifact ID." });
  }
});

export const knowledgeCompletionResultSchema = z.union([completedKnowledgeSetSchema, legacyKnowledgeCompletionResultSchema]);

export type KnowledgeCoverageAudit = z.infer<typeof knowledgeCoverageAuditSchema>;
export type KnowledgeCoverageCell = z.infer<typeof knowledgeCoverageCellSchema>;
export type KnowledgeCoverageGap = z.infer<typeof knowledgeCoverageGapSchema>;
export type KnowledgeCompletionPlan = z.infer<typeof knowledgeCompletionPlanSchema>;
export type KnowledgeCompletionTask = z.infer<typeof knowledgeCompletionTaskSchema>;
export type KnowledgeCompletionResult = z.infer<typeof knowledgeCompletionResultSchema>;
export type CompletedKnowledgeSet = z.infer<typeof completedKnowledgeSetSchema>;
