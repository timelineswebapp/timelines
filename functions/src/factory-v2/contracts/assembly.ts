import { z } from "zod";
import { boundedText, hashSchema, historicalDateSchema, idSchema, modelExecutionRefSchema } from "./common";

export const V2_B_PIPELINE_VERSION = "factory-v2-b.2" as const;
export const V2_B_LEGACY_PIPELINE_VERSION = "factory-v2-b.1" as const;
export const V2_B_SCHEMA_VERSION = "factory-v2-b.3" as const;
export const V2_B_PREVIOUS_SCHEMA_VERSION = "factory-v2-b.2" as const;
export const V2_B_LEGACY_SCHEMA_VERSION = "factory-v2-b.1" as const;
export const V2_B_SELECTION_POLICY_VERSION = "evidence-backed-selection-v2-b.1" as const;
export const V2_B_PROMPT_VERSION = "factory-v2-b-prompts.1" as const;

const unique = <T>(values: T[]) => new Set(values).size === values.length;
const legacyV2ASourceBundleSchema = z.object({
  pipelineVersion: z.literal("factory-v2-a.10"),
  schemaVersion: z.literal("factory-v2-a.3"),
  policyVersion: z.literal("evidence-first-v2-a.9"),
  promptVersion: z.literal("factory-v2-a-prompts.8")
}).strict();
const currentV2ASourceBundleSchema = z.object({
  pipelineVersion: z.literal("factory-v2-a.13"),
  schemaVersion: z.literal("factory-v2-a.5"),
  policyVersion: z.literal("evidence-first-v2-a.11"),
  promptVersion: z.literal("factory-v2-a-prompts.8")
}).strict();
const previousV2ASourceBundleSchema = z.object({
  pipelineVersion: z.literal("factory-v2-a.12"),
  schemaVersion: z.literal("factory-v2-a.4"),
  policyVersion: z.literal("evidence-first-v2-a.11"),
  promptVersion: z.literal("factory-v2-a-prompts.8")
}).strict();

export const v2BEnvelopeFields = {
  artifactId: idSchema,
  artifactType: boundedText(3, 80),
  schemaVersion: z.enum([V2_B_LEGACY_SCHEMA_VERSION, V2_B_PREVIOUS_SCHEMA_VERSION, V2_B_SCHEMA_VERSION]),
  pipelineVersion: z.enum([V2_B_LEGACY_PIPELINE_VERSION, V2_B_PIPELINE_VERSION]),
  policyVersion: boundedText(3, 120),
  promptVersion: boundedText(3, 120).nullable(),
  modelExecutionRef: modelExecutionRefSchema.nullable(),
  parentArtifactIds: z.array(idSchema).max(20).refine(unique),
  payloadHash: hashSchema,
  createdAt: z.string().datetime().nullable(),
  corpusId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/u),
  topicId: idSchema,
  runId: idSchema.nullable(),
  generation: z.number().int().positive(),
  sourceKnowledgeRunId: idSchema.nullable(),
  sourceKnowledgeBundle: z.union([legacyV2ASourceBundleSchema, previousV2ASourceBundleSchema, currentV2ASourceBundleSchema]),
  executionMode: z.literal("SHADOW"),
  publicationEligible: z.literal(false),
  governanceSubmissionAllowed: z.literal(false),
  immutable: z.literal(true)
} as const;

export const significanceClassSchema = z.enum(["ESSENTIAL", "MAJOR", "SUPPORTING", "EXCLUDE"]);
export const coverageRelationSchema = z.enum(["PRIMARY", "SUPPORTING", "NONE"]);
export const significanceCriterionFindingSchema = z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]);

export const significanceCriteriaSchema = z.object({
  turningPointValue: significanceCriterionFindingSchema,
  causalImportance: significanceCriterionFindingSchema,
  consequence: significanceCriterionFindingSchema,
  institutionalImportance: significanceCriterionFindingSchema,
  adoptionOrScale: significanceCriterionFindingSchema,
  explanatoryValue: significanceCriterionFindingSchema,
  topicRelevance: significanceCriterionFindingSchema,
  historiographicalProminence: significanceCriterionFindingSchema,
  relationshipToLaterDevelopments: significanceCriterionFindingSchema,
  uniqueness: significanceCriterionFindingSchema
}).strict();

export const significanceJudgmentSchema = z.object({
  eventVersionId: idSchema,
  significanceClass: significanceClassSchema,
  comparativeRank: z.number().int().positive().max(200),
  criteria: significanceCriteriaSchema,
  rationale: boundedText(20, 2000),
  phaseCoverage: z.array(z.object({ phaseId: idSchema, relation: coverageRelationSchema, rationale: boundedText(10, 800) }).strict()).max(24),
  dimensionCoverage: z.array(z.object({ dimensionId: idSchema, relation: coverageRelationSchema, rationale: boundedText(10, 800) }).strict()).max(20),
  redundantWithEventVersionIds: z.array(idSchema).max(30).refine(unique),
  redundancyRationale: boundedText(10, 1000).nullable()
}).strict();

export const comparativeReasoningSchema = z.object({
  preferredEventVersionId: idSchema,
  otherEventVersionId: idSchema,
  reason: boundedText(20, 1200)
}).strict();

export const significanceProposalSchema = z.object({
  judgments: z.array(significanceJudgmentSchema).min(1).max(200),
  comparisons: z.array(comparativeReasoningSchema).max(500),
  completenessFindings: z.array(z.object({
    classification: z.enum(["MISSING_MATERIAL_MILESTONE", "CONTEXTUAL_THEME", "STATE_LEGACY", "OUTSIDE_SCOPE", "INAPPROPRIATE_GRANULARITY", "ALREADY_REPRESENTED", "UNSUPPORTED_CANDIDATE"]),
    relatedPhaseIds: z.array(idSchema).max(24).refine(unique),
    relatedDimensionIds: z.array(idSchema).max(20).refine(unique),
    blocking: z.boolean(),
    rationale: boundedText(20, 1600)
  }).strict()).max(100)
}).strict();

export const eligibilityReasonSchema = z.enum([
  "SEMANTIC_TYPE_INELIGIBLE",
  "SCOPE_INCOMPATIBLE",
  "TEMPORAL_ANCHOR_INSUFFICIENT",
  "FABRICATED_PRECISION",
  "CORE_CLAIM_UNSUPPORTED",
  "SOURCE_AUTHORITY_BURDEN_FAILED",
  "BLOCKING_MATERIAL_CONFLICT",
  "CANDIDATE_IDENTITY_INVALID"
]);

export const candidateSelectionAssessmentSchema = z.object({
  eventVersionId: idSchema,
  inputOrdinal: z.number().int().nonnegative(),
  eligible: z.boolean(),
  eligibilityReasons: z.array(eligibilityReasonSchema).max(8).refine(unique),
  significanceClass: significanceClassSchema,
  comparativeRank: z.number().int().positive().max(200),
  criteria: significanceCriteriaSchema,
  significanceRationale: boundedText(20, 2000),
  phaseCoverage: z.array(z.object({ phaseId: idSchema, relation: coverageRelationSchema, rationale: boundedText(3, 800) }).strict()).max(24),
  dimensionCoverage: z.array(z.object({ dimensionId: idSchema, relation: coverageRelationSchema, rationale: boundedText(3, 800) }).strict()).max(20),
  selectionState: z.enum(["SELECTED", "EXCLUDED_INELIGIBLE", "EXCLUDED_EDITORIAL", "EXCLUDED_REDUNDANT", "EXCLUDED_CAPACITY"]),
  selectionRationale: boundedText(10, 2000)
}).strict();

export const redundancyDecisionSchema = z.object({
  keptEventVersionId: idSchema,
  excludedEventVersionId: idSchema,
  relationship: z.enum(["IDENTICAL", "SAME_EVENT_DIFFERENT_GRANULARITY"]),
  deterministicEvidence: z.array(boundedText(3, 500)).min(1).max(10),
  rationale: boundedText(20, 1200)
}).strict();

export const temporalDiagnosticSchema = z.object({
  code: z.enum(["EXTREME_EARLY_CONCENTRATION", "UNEXPLAINED_LATE_ABSENCE", "LARGE_UNCOVERED_INTERVAL", "ONGOING_TOPIC_STALENESS", "CLOSED_EPISODE_BOUNDARY_DRIFT"]),
  blocking: z.boolean(),
  rationale: boundedText(20, 1200),
  eventVersionIds: z.array(idSchema).max(200).refine(unique)
}).strict();

export const selectionArtifactSchema = z.object({
  ...v2BEnvelopeFields,
  artifactType: z.literal("EDITORIAL_SELECTION"),
  selectionArtifactId: idSchema,
  scopeContractId: idSchema,
  scopePayloadHash: hashSchema,
  researchMapId: idSchema,
  researchMapPayloadHash: hashSchema,
  completedKnowledgeSetId: idSchema.optional(),
  completedKnowledgeSetHash: hashSchema.optional(),
  finalCoverageAuditId: idSchema.optional(),
  finalCoverageAuditHash: hashSchema.optional(),
  candidateInputHash: hashSchema.optional(),
  completeCandidateEventVersionIds: z.array(idSchema).min(1).max(200).refine(unique),
  eligibleCandidateEventVersionIds: z.array(idSchema).max(200).refine(unique),
  assessments: z.array(candidateSelectionAssessmentSchema).min(1).max(200),
  comparisons: z.array(comparativeReasoningSchema).max(500),
  redundancyDecisions: z.array(redundancyDecisionSchema).max(200),
  selectedEventVersionIds: z.array(idSchema).max(20).refine(unique),
  orderedEvents: z.array(z.object({ eventVersionId: idSchema, ordinal: z.number().int().positive(), temporal: z.object({ start: historicalDateSchema, end: historicalDateSchema.nullable(), uncertainty: boundedText(3, 800).nullable() }).strict() }).strict()).max(20),
  coverageSummary: z.object({
    requiredPhaseIds: z.array(idSchema).max(24).refine(unique),
    coveredPhaseIds: z.array(idSchema).max(24).refine(unique),
    missingPhaseIds: z.array(idSchema).max(24).refine(unique),
    requiredDimensionIds: z.array(idSchema).max(20).refine(unique),
    coveredDimensionIds: z.array(idSchema).max(20).refine(unique),
    missingDimensionIds: z.array(idSchema).max(20).refine(unique)
  }).strict(),
  temporalDiagnostics: z.array(temporalDiagnosticSchema).max(20),
  completenessFindings: significanceProposalSchema.shape.completenessFindings,
  status: z.enum(["PASS", "FAILED"]),
  failureCodes: z.array(z.enum(["EVENT_LIMIT_UNSATISFIABLE", "COVERAGE_GAP_MATERIAL", "EVENT_COUNT_BELOW_MINIMUM", "NO_ELIGIBLE_CANDIDATES", "SIGNIFICANCE_INPUT_INVALID", "MATERIAL_OMISSION_UNRESOLVED"])).max(10).refine(unique),
  selectionPolicyVersion: boundedText(3, 120),
  significancePromptVersion: z.literal(V2_B_PROMPT_VERSION)
}).strict().superRefine((artifact, context) => {
  if (artifact.schemaVersion === V2_B_SCHEMA_VERSION) {
    for (const field of ["completedKnowledgeSetId", "completedKnowledgeSetHash", "finalCoverageAuditId", "finalCoverageAuditHash", "candidateInputHash"] as const) {
      if (!artifact[field]) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${field} is required for explicit completed-knowledge-set lineage.` });
    }
    if (artifact.sourceKnowledgeRunId !== null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceKnowledgeRunId"], message: "Current B1 artifacts must not identify their knowledge universe by execution run." });
  }
});

export const selectionModelExecutionSchema = z.object({
  ...v2BEnvelopeFields,
  createdAt: z.string().datetime(),
  runId: idSchema,
  sourceKnowledgeRunId: idSchema.nullable(),
  completedKnowledgeSetId: idSchema.optional(),
  completedKnowledgeSetHash: hashSchema.optional(),
  finalCoverageAuditId: idSchema.optional(),
  finalCoverageAuditHash: hashSchema.optional(),
  candidateInputHash: hashSchema.optional(),
  artifactType: z.literal("SELECTION_MODEL_EXECUTION"),
  executionId: idSchema,
  stage: z.literal("SIGNIFICANCE_SELECTION"),
  inputArtifactIds: z.array(idSchema).min(2).max(205).refine(unique),
  inputHash: hashSchema,
  promptHash: hashSchema,
  responseHash: hashSchema,
  validationState: z.enum(["VALID", "REPAIRED", "FAILED"]),
  boundedResponse: z.string().max(80_000),
  responseTruncated: z.boolean(),
  repairAttempt: z.number().int().min(0).max(1),
  transportAttempts: z.number().int().min(1).max(3),
  usage: z.object({ inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(), totalTokens: z.number().int().nonnegative().nullable(), monetaryCost: z.null(), costMeasurement: z.literal("NOT_MEASURABLE") }).strict(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  latencyMs: z.number().int().nonnegative().max(300_000)
}).strict().superRefine((artifact, context) => {
  if (artifact.schemaVersion === V2_B_SCHEMA_VERSION) {
    for (const field of ["completedKnowledgeSetId", "completedKnowledgeSetHash", "finalCoverageAuditId", "finalCoverageAuditHash", "candidateInputHash"] as const) {
      if (!artifact[field]) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${field} is required for explicit completed-knowledge-set lineage.` });
    }
    if (artifact.sourceKnowledgeRunId !== null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceKnowledgeRunId"], message: "Current B1 executions must not identify their knowledge universe by execution run." });
  }
});

export type SignificanceProposal = z.infer<typeof significanceProposalSchema>;
export type SelectionArtifact = z.infer<typeof selectionArtifactSchema>;
export type SelectionModelExecution = z.infer<typeof selectionModelExecutionSchema>;
