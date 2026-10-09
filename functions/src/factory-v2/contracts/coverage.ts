import { z } from "zod";
import { boundedText, hashSchema, httpsUrlSchema, idSchema, immutableEnvelopeFields, V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION, V2_LEGACY_SCHEMA_VERSION, V2_PIPELINE_VERSION, V2_SCHEMA_VERSION } from "./common";

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
    "MATERIAL_CONFLICT_BLOCKS_COVERAGE",
    "MISSING_HISTORICAL_PERSPECTIVE",
    "MISSING_INDEPENDENT_SCHOLARSHIP"
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

/**
 * Evidence-derived, immutable remediation authority.  Unlike the retired
 * Routing Obligation, this artifact cannot exist until an initial audit has
 * established a material deficiency against acquired evidence.
 */
export const gapObligationSchema = z.object({
  ...immutableEnvelopeFields,
  gapObligationId: idSchema,
  scopeContractId: idSchema,
  scopePayloadHash: hashSchema,
  researchMapId: idSchema,
  researchMapPayloadHash: hashSchema,
  parentCoverageAuditId: idSchema,
  coverageGapIds: ids(200),
  questionIds: ids(120),
  phaseIds: ids(24),
  dimensionIds: ids(20),
  historicalRequirements: z.array(z.object({
    kind: z.enum(["STAKEHOLDER", "PARTY_PARTICIPANT", "AFFECTED_COMMUNITY", "CUSTODIAL_COMMUNITY", "INDEPENDENT_SCHOLARSHIP", "MATERIAL_JURISDICTION"]),
    label: boundedText(2, 160),
    rationale: boundedText(10, 600)
  }).strict()).max(40),
  existingSupportingClaimVersionIds: ids(300),
  existingSourceSnapshotIds: ids(300),
  deficiencyCode: boundedText(3, 120),
  materialReason: boundedText(10, 1200),
  requiredRoles: z.array(z.enum(["PRIMARY_RECORD", "CORROBORATION", "INTERPRETATION", "PERSPECTIVE_TESTIMONY"])).min(1).max(4).refine(unique),
  permittedSubjectRelationships: z.array(z.enum(["INDEPENDENT", "SUBJECT_SELF", "STATE_PARTY", "PARTICIPANT", "COMMUNITY_CUSTODIAN"])).min(1).max(5).refine(unique),
  minimumIndependentGroups: z.number().int().min(0).max(4),
  candidatePublisherVersionIds: ids(60),
  specialistCollectionProfileIds: ids(60),
  budget: completionBudgetSchema,
  state: z.literal("MATERIAL_EVIDENCE_GAP")
}).strict();

export const knowledgeCompletionTaskSchema = z.object({
  taskId: idSchema,
  gapIds: ids(20),
  gapObligationIds: ids(20).optional(),
  phaseIds: ids(24),
  dimensionIds: ids(20),
  questionIds: ids(120),
  questionId: idSchema,
  question: boundedText(10, 900),
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
  round: z.union([z.literal(0), z.literal(1)]),
  budget: completionBudgetSchema,
  tasks: z.array(knowledgeCompletionTaskSchema).max(5),
  gapObligationIds: ids(200).optional(),
  unplannedMaterialGapIds: ids(200)
}).strict().superRefine((plan, context) => {
  if (plan.round === 0 && plan.tasks.length !== 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ["tasks"], message: "A no-completion plan cannot contain tasks." });
  if (plan.round === 1 && plan.tasks.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ["tasks"], message: "A completion round requires at least one gap-directed task." });
});

/** Immutable, per-candidate proof for the single evidence-derived completion
 * round.  It distinguishes an empty admissible yield from transport/security
 * failure and prevents a later candidate from hiding an earlier attempt. */
export const completionCandidateAttemptSchema = z.object({
  ...immutableEnvelopeFields,
  completionCandidateAttemptId: idSchema,
  completionPlanId: idSchema,
  gapObligationIds: ids(20),
  questionId: idSchema,
  authorityBindingId: idSchema,
  publisherVersionId: idSchema,
  sourceSnapshotId: idSchema.nullable(),
  /** Null proves that discovery, rather than retrieval, exhausted this
   * already-sealed authority. */
  canonicalUrl: httpsUrlSchema.nullable(),
  attemptOrder: z.number().int().min(1).max(4),
  retrievalOutcome: z.enum(["RETRIEVED", "DISCOVERY_NO_URLS", "DISCOVERY_HTTP_403", "DISCOVERY_TIMEOUT", "DISCOVERY_SECURITY_REJECTED", "DISCOVERY_NO_RELEVANT_URL", "RETRIEVAL_FAILED", "SECURITY_REJECTED", "DEADLINE_EXHAUSTED", "BUDGET_EXHAUSTED"]),
  admissibleAtomicClaimCount: z.number().int().nonnegative().max(100),
  gapRelevantAtomicClaimCount: z.number().int().nonnegative().max(100),
  rejectedAtomicClaimCount: z.number().int().nonnegative().max(100),
  terminalReason: z.enum(["QUALIFYING_EVIDENCE", "ZERO_CLAIM_YIELD", "CLAIMS_INADMISSIBLE", "DISCOVERY_NO_URLS", "DISCOVERY_HTTP_403", "DISCOVERY_TIMEOUT", "DISCOVERY_SECURITY_REJECTED", "DISCOVERY_NO_RELEVANT_URL", "RETRIEVAL_FAILED", "SECURITY_REJECTED", "DEADLINE_EXHAUSTED", "BUDGET_EXHAUSTED", "CANDIDATES_EXHAUSTED"]),
  fallbackDisposition: z.enum(["STOP_QUALIFYING_EVIDENCE", "STOP_INADMISSIBLE_CLAIMS", "TRY_NEXT_SEALED_CANDIDATE", "STOP_CANDIDATES_EXHAUSTED", "STOP_BUDGET_OR_DEADLINE", "STOP_SECURITY_FAIL_CLOSED"])
}).strict().superRefine((attempt, context) => {
  if (attempt.retrievalOutcome === "RETRIEVED" && (attempt.sourceSnapshotId === null || attempt.canonicalUrl === null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceSnapshotId"], message: "Retrieved completion candidate requires a sealed URL and snapshot." });
  if (attempt.terminalReason === "ZERO_CLAIM_YIELD" && (attempt.admissibleAtomicClaimCount !== 0 || attempt.gapRelevantAtomicClaimCount !== 0 || attempt.rejectedAtomicClaimCount !== 0)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["terminalReason"], message: "ZERO_CLAIM_YIELD requires no admissible or rejected atomic claims." });
  if (attempt.terminalReason === "QUALIFYING_EVIDENCE" && attempt.gapRelevantAtomicClaimCount === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ["terminalReason"], message: "Qualifying evidence requires a gap-relevant admissible claim." });
});

/** The completion retrieval universe is sealed after normal bounded authority
 * admission and before any candidate is fetched or extracted. */
export const completionCandidatePoolSchema = z.object({
  ...immutableEnvelopeFields,
  completionCandidatePoolId: idSchema,
  completionPlanId: idSchema,
  candidates: z.array(z.object({
    questionId: idSchema,
    gapObligationIds: ids(20),
    authorityBindingId: idSchema,
    publisherVersionId: idSchema,
    canonicalUrl: httpsUrlSchema,
    candidateRank: z.number().int().min(1).max(4)
  }).strict()).max(30).refine((candidates) => unique(candidates.map((candidate) => `${candidate.questionId}:${candidate.canonicalUrl}`)), "Completion candidates must be unique per question.")
}).strict();

/** The authority universe is sealed before discovery.  A URL pool is a
 * downstream execution detail and may not redefine eligibility. */
export const completionAuthorityCandidatePoolSchema = z.object({
  ...immutableEnvelopeFields,
  completionAuthorityCandidatePoolId: idSchema,
  completionPlanId: idSchema,
  candidates: z.array(z.object({
    questionId: idSchema,
    gapObligationIds: ids(20),
    authorityBindingId: idSchema,
    publisherVersionId: idSchema,
    candidateRank: z.number().int().min(1).max(4),
    disposition: z.enum(["ELIGIBLE", "EXCLUDED_CEILING"]),
    exclusionReason: z.enum(["PER_GAP_AUTHORITY_CEILING"]).nullable()
  }).strict()).max(120).refine((candidates) => unique(candidates.map((candidate) => `${candidate.questionId}:${candidate.authorityBindingId}`)), "Completion authority candidates must be unique per question."),
  candidateCeiling: z.number().int().min(1).max(4)
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
  authorityAcquisitionRounds: z.array(z.object({
    topicAuthoritySetId: idSchema,
    routingObligationSetId: idSchema.nullable(),
    authorityResearchPlanId: idSchema,
    controlledResearchLedgerId: idSchema,
    perspectiveAuditId: idSchema,
    confidenceVectorId: idSchema
  }).strict()).min(1).max(2).refine((rounds) => unique(rounds.map((round) => round.controlledResearchLedgerId)), "Authority acquisition rounds must be unique."),
  /** Evidence-derived obligations sealed between initial and completion rounds. */
  gapObligationIds: ids(200).optional(),
  /** Every attempt in a completion candidate fallback chain, in deterministic
   * order. Empty only when no completion round was required. */
  completionCandidateAttemptIds: ids(20).optional(),
  completionCandidatePoolId: idSchema.nullable().optional(),
  completionAuthorityCandidatePoolId: idSchema.nullable().optional(),
  /** Historical pre-Authority-First lineage only. New canonical CKS artifacts
   * use authorityAcquisitionRounds and never populate queryLedgerId. */
  queryLedgerId: idSchema.optional(),
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
export type GapObligation = z.infer<typeof gapObligationSchema>;
export type KnowledgeCompletionPlan = z.infer<typeof knowledgeCompletionPlanSchema>;
export type CompletionCandidateAttempt = z.infer<typeof completionCandidateAttemptSchema>;
export type CompletionCandidatePool = z.infer<typeof completionCandidatePoolSchema>;
export type CompletionAuthorityCandidatePool = z.infer<typeof completionAuthorityCandidatePoolSchema>;
export type KnowledgeCompletionTask = z.infer<typeof knowledgeCompletionTaskSchema>;
export type KnowledgeCompletionResult = z.infer<typeof knowledgeCompletionResultSchema>;
export type CompletedKnowledgeSet = z.infer<typeof completedKnowledgeSetSchema>;
