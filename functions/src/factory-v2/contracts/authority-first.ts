import { z } from "zod";
import { boundedText, hashSchema, httpsUrlSchema, idSchema, immutableEnvelopeFields, languageSchema } from "./common";
import { affectedCommunityEvidenceCapacitySchema, claimTypeSchema, historicalJurisdictionCapacitySchema, type AffectedCommunityEvidenceCapacity, type HistoricalJurisdictionCapacity } from "./knowledge";

const unique = <T>(values: T[]) => new Set(values).size === values.length;
const ids = (maximum: number, minimum = 0) => z.array(idSchema).min(minimum).max(maximum).refine(unique, "IDs must be unique.");
const strings = (maximum: number, itemMaximum = 240) => z.array(boundedText(1, itemMaximum)).max(maximum).refine(unique, "Values must be unique.");

/**
 * Evidence-derived completion successor.  Historical routing artifacts remain
 * parseable for provenance, but are not part of this policy's execution path.
 */
export const AUTHORITY_FIRST_POLICY_VERSION = "authority-first-research.36" as const;
/** Deterministic boundary between historical participation and source authority. */
export const PARTY_PARTICIPANT_SEMANTICS_POLICY_VERSION = "party-participant-semantics.4" as const;
export const AUTHORITY_REGISTRY_VERSION = "authority-registry.4" as const;
/** Versioned admission policy for registry-governed specialist collections. */
export const SPECIALIST_COLLECTION_PROFILE_POLICY_VERSION = "specialist-collection-profile.1" as const;
export const CONTROLLED_RESEARCH_BUDGET_VERSION = "controlled-research-budget.1" as const;

export const authorityFamilySchema = z.enum([
  "EDITED_REFERENCE",
  "ARCHIVE_LIBRARY",
  "PUBLIC_SCIENTIFIC_INSTITUTION",
  "INTERNATIONAL_STANDARDS_BODY",
  "ACADEMIC_SCHOLARLY",
  "MUSEUM_HERITAGE_MEMORY",
  "CONTEMPORARY_JOURNALISM",
  "COMMUNITY_CUSTODIAL",
  "SPECIALIST",
  "SUBJECT_ASSOCIATED"
]);

export const authorityResearchRoleSchema = z.enum([
  "ORIENTATION",
  "PRIMARY_RECORD",
  "CORROBORATION",
  "INTERPRETATION",
  "PERSPECTIVE_TESTIMONY"
]);

export const subjectRelationshipSchema = z.enum([
  "INDEPENDENT",
  "SUBJECT_SELF",
  "STATE_PARTY",
  "PARTICIPANT",
  "COMMUNITY_CUSTODIAN",
  "COMMUNITY_EVIDENCE_RECORDS_HOLDER"
]);

export const institutionalDiscoveryMechanismSchema = z.enum([
  "DIRECT_URL",
  "OFFICIAL_API",
  "INSTITUTIONAL_SITE_SEARCH",
  "SITEMAP",
  "REGISTERED_DOMAIN_DISCOVERY",
  "GOOGLE_GROUNDING_ESCALATION"
]);

export const collectionCapabilityClassSchema = z.enum(["MANUSCRIPTS_RARE_BOOKS", "DIGITIZED_BOOKS", "ARCHIVAL_FINDING_AIDS", "MUSEUM_COLLECTIONS", "COMMUNITY_CUSTODIAL", "SCHOLARLY_CATALOGUE", "SCIENTIFIC_TECHNICAL_ARCHIVES", "PERIODICALS", "MATERIAL_CULTURE"]);

export const specialistCollectionProfileSchema = z.object({
  profileId: idSchema,
  publisherVersionId: idSchema,
  version: z.number().int().positive().max(1000),
  policyVersion: z.literal(SPECIALIST_COLLECTION_PROFILE_POLICY_VERSION),
  capabilityClass: collectionCapabilityClassSchema,
  collectionScope: boundedText(10, 600),
  endpoint: httpsUrlSchema,
  discoveryMechanisms: z.array(institutionalDiscoveryMechanismSchema.exclude(["GOOGLE_GROUNDING_ESCALATION"])).min(1).max(4).refine(unique),
  supportedQueryParameters: strings(12, 80),
  languages: z.array(languageSchema).min(1).max(20).refine(unique),
  geography: strings(20, 160),
  historicalPeriods: strings(20, 160),
  contentTypes: strings(12, 120),
  accessLimitations: strings(12, 300),
  verificationProvenance: boundedText(10, 600),
  effectiveAt: z.string().datetime()
}).strict();

export const authorityRegistryCapabilitySchema = z.object({
  authorityFamily: authorityFamilySchema,
  officialEndpoints: z.array(httpsUrlSchema).min(1).max(20).refine(unique),
  historicalPeriods: strings(20, 160),
  defaultSubjectRelationship: subjectRelationshipSchema,
  discoveryMechanisms: z.array(institutionalDiscoveryMechanismSchema.exclude(["GOOGLE_GROUNDING_ESCALATION"])).min(1).max(5).refine(unique),
  specialistCollectionProfiles: z.array(specialistCollectionProfileSchema).max(12),
  historicalJurisdictionCapacities: z.array(historicalJurisdictionCapacitySchema).max(24).default([]),
  affectedCommunityEvidenceCapacities: z.array(affectedCommunityEvidenceCapacitySchema).max(24).default([]),
  storageConstraints: strings(20, 500),
  registryVersion: z.literal(AUTHORITY_REGISTRY_VERSION)
}).strict();

export const topicAuthorityProposalSchema = z.object({
  publisherVersionId: idSchema,
  researchQuestionIds: ids(120, 1),
  roles: z.array(authorityResearchRoleSchema).min(1).max(5).refine(unique),
  claimTypes: z.array(claimTypeSchema).min(1).max(12).refine(unique),
  subjectRelationship: subjectRelationshipSchema,
  perspectiveTags: strings(20, 160),
  historicalJurisdictionCapacityIds: ids(24).optional().transform((value) => value || []),
  affectedCommunityEvidenceCapacityIds: ids(24).optional().transform((value) => value || []),
  /** Legacy routing lineage only.  The .16 canonical path never derives
   * historical sufficiency from a planned route. */
  routingObligationIds: ids(120).optional().transform((value) => value || []),
  rationale: boundedText(10, 1000)
}).strict();

export const routingObligationKindSchema = z.enum(["STAKEHOLDER", "PARTY_PARTICIPANT", "AFFECTED_COMMUNITY", "CUSTODIAL_COMMUNITY", "MATERIAL_JURISDICTION"]);
export const routingObligationSchema = z.object({
  routingObligationId: idSchema,
  researchQuestionId: idSchema,
  requirementKind: routingObligationKindSchema,
  semanticIdentity: boundedText(2, 320),
  label: boundedText(2, 160),
  rationale: boundedText(10, 600),
  historicalActionBasis: boundedText(10, 600).nullable().optional(),
  requiredRoles: z.array(authorityResearchRoleSchema).min(1).max(5).refine(unique),
  permittedSubjectRelationships: z.array(subjectRelationshipSchema).min(1).max(5).refine(unique),
  materialGeography: strings(20, 160)
}).strict();

export const routingObligationSetSchema = z.object({
  ...immutableEnvelopeFields,
  routingObligationSetId: idSchema,
  scopeContractId: idSchema,
  scopePayloadHash: hashSchema,
  researchMapId: idSchema,
  researchMapPayloadHash: hashSchema,
  obligations: z.array(routingObligationSchema).max(120).refine((items) => unique(items.map((item) => item.routingObligationId))),
  validationStatus: z.literal("LOCKED")
}).strict();

export const topicAuthorityBindingSchema = topicAuthorityProposalSchema.extend({
  bindingId: idSchema,
  publisherId: z.string().uuid(),
  authorityFamily: authorityFamilySchema,
  independenceGroupId: idSchema,
  verifiedDomains: z.array(boundedText(3, 253)).min(1).max(30).refine(unique),
  languages: z.array(languageSchema).min(1).max(20).refine(unique),
  geography: strings(20, 160),
  officialEndpoints: z.array(httpsUrlSchema).min(1).max(20).refine(unique),
  discoveryMechanisms: z.array(institutionalDiscoveryMechanismSchema.exclude(["GOOGLE_GROUNDING_ESCALATION"])).min(1).max(5).refine(unique),
  specialistCollectionProfiles: z.array(specialistCollectionProfileSchema).max(12),
  historicalJurisdictionCapacities: z.array(historicalJurisdictionCapacitySchema).max(24).default([]),
  affectedCommunityEvidenceCapacities: z.array(affectedCommunityEvidenceCapacitySchema).max(24).default([]),
  validationStatus: z.literal("ELIGIBLE")
}).strict();

/**
 * Immutable pre-acquisition provenance for a protected historical
 * requirement. This records capacity selection only; it never asserts that
 * qualifying evidence was acquired.
 */
export const protectedAvailabilityDecisionSchema = z.object({
  requirementId: idSchema,
  requirementKind: z.enum(["INDEPENDENT_SCHOLARSHIP", "PARTY_PARTICIPANT", "AFFECTED_COMMUNITY", "CUSTODIAL_COMMUNITY", "MATERIAL_JURISDICTION"]),
  requirementLabel: boundedText(1, 160),
  researchQuestionId: idSchema,
  eligibleCandidates: z.array(z.object({
    publisherVersionId: idSchema,
    eligibleRoles: z.array(authorityResearchRoleSchema.exclude(["ORIENTATION"])).min(1).max(4).refine(unique),
    subjectRelationship: subjectRelationshipSchema,
    authorityFamily: authorityFamilySchema,
    historicalJurisdictionCapacityIds: ids(24),
    affectedCommunityEvidenceCapacityIds: ids(24),
    rejectionReason: boundedText(2, 240).nullable()
  }).strict()).max(60),
  modelProposedPublisherVersionIds: ids(60),
  selectedPublisherVersionId: idSchema.nullable(),
  selectedHistoricalJurisdictionCapacityIds: ids(24),
  selectedAffectedCommunityEvidenceCapacityIds: ids(24),
  selectionMethod: z.enum(["MODEL_PRESERVED", "DETERMINISTIC_UNIQUE", "DETERMINISTIC_REGISTRY_COMPLETION", "NO_ELIGIBLE_CAPACITY"]),
  registryVersion: z.literal(AUTHORITY_REGISTRY_VERSION),
  policyVersion: z.literal(AUTHORITY_FIRST_POLICY_VERSION)
}).strict();

/**
 * Immutable pre-acquisition accounting for the minimum independent capacity
 * required by a contested question. It proves only the Registry universe and
 * selected bounded acquisition opportunities; evidence remains authoritative
 * only after retrieval and final audit.
 */
export const contestedAvailabilityDecisionSchema = z.object({
  researchQuestionId: idSchema,
  eligibleCandidates: z.array(z.object({
    publisherVersionId: idSchema,
    independenceGroupId: idSchema,
    eligibleRoles: z.array(authorityResearchRoleSchema.exclude(["ORIENTATION"])).min(1).max(4).refine(unique),
    authorityFamily: authorityFamilySchema
  }).strict()).max(60),
  modelProposedPublisherVersionIds: ids(60),
  selectedPublisherVersionIds: ids(24),
  selectionMethod: z.enum(["MODEL_PRESERVED", "DETERMINISTIC_REGISTRY_COMPLETION", "NO_ELIGIBLE_CAPACITY"]),
  registryVersion: z.literal(AUTHORITY_REGISTRY_VERSION),
  policyVersion: z.literal(AUTHORITY_FIRST_POLICY_VERSION)
}).strict();

export const topicAuthoritySetSchema = z.object({
  ...immutableEnvelopeFields,
  topicAuthoritySetId: idSchema,
  scopeContractId: idSchema,
  scopePayloadHash: hashSchema,
  researchMapId: idSchema,
  researchMapPayloadHash: hashSchema,
  registryVersion: z.literal(AUTHORITY_REGISTRY_VERSION),
  registryHash: hashSchema,
  /** Null for evidence-derived .16+ authority sets. */
  routingObligationSetId: idSchema.nullable(),
  bindings: z.array(topicAuthorityBindingSchema).min(1).max(24),
  protectedAvailabilityDecisions: z.array(protectedAvailabilityDecisionSchema).max(120).default([]),
  contestedAvailabilityDecisions: z.array(contestedAvailabilityDecisionSchema).max(120).default([]),
  /** Historical route records only; canonical .16+ sets seal an empty list. */
  obligationRoutes: z.array(z.object({ routingObligationId: idSchema, bindingId: idSchema }).strict()).max(240).refine((items) => unique(items.map((item) => `${item.routingObligationId}:${item.bindingId}`))),
  rejectedPublisherVersionIds: ids(60),
  criticalQuestionIds: ids(120),
  contestedQuestionIds: ids(120),
  validationStatus: z.literal("VALIDATED")
}).strict().superRefine((set, context) => {
  if (set.artifactId !== set.topicAuthoritySetId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["topicAuthoritySetId"], message: "Topic Authority Set identity must match the artifact identity." });
  const covered = new Set(set.bindings.filter((binding) => binding.roles.some((role) => role !== "ORIENTATION")).flatMap((binding) => binding.researchQuestionIds));
  for (const questionId of set.criticalQuestionIds) if (!covered.has(questionId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["bindings"], message: `Critical question ${questionId} lacks evidentiary-core authority coverage.` });
});

export const controlledResearchBudgetSchema = z.object({
  version: z.literal(CONTROLLED_RESEARCH_BUDGET_VERSION),
  maximumControlledDiscoveryOperations: z.literal(25),
  maximumGapRepairOperations: z.literal(5),
  maximumGroundingEscalationCalls: z.literal(2),
  maximumDirectRetrievals: z.literal(40),
  maximumConcurrency: z.literal(3),
  maximumCompletionRounds: z.literal(1),
  maximumWholeRunSeconds: z.literal(1200),
  maximumGapRoundSeconds: z.literal(480)
}).strict();

export const authorityResearchPlanOperationSchema = z.object({
  plannedOperationId: idSchema,
  authorityBindingId: idSchema,
  researchQuestionIds: ids(120, 1),
  routingObligationIds: ids(120),
  layer: z.enum(["ORIENTATION", "EVIDENTIARY_CORE"]),
  mechanism: institutionalDiscoveryMechanismSchema.exclude(["GOOGLE_GROUNDING_ESCALATION"]),
  endpoint: httpsUrlSchema,
  specialistCollectionProfileId: idSchema.nullable(),
  /** Deterministic, bounded attempt sequence within one authority binding. */
  attemptOrder: z.number().int().nonnegative().max(12),
  purpose: boundedText(10, 1000)
}).strict();

export const authorityResearchPlanSchema = z.object({
  ...immutableEnvelopeFields,
  authorityResearchPlanId: idSchema,
  topicAuthoritySetId: idSchema,
  /** Null for evidence-derived .16+ research plans. */
  routingObligationSetId: idSchema.nullable(),
  budget: controlledResearchBudgetSchema,
  operations: z.array(authorityResearchPlanOperationSchema).min(1).max(25),
  coveredCriticalQuestionIds: ids(120),
  /** Historical route coverage only; canonical .16+ plans seal an empty list. */
  coveredRoutingObligationIds: ids(120),
  state: z.literal("AUTHORIZED")
}).strict().superRefine((plan, context) => {
  if (plan.artifactId !== plan.authorityResearchPlanId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["authorityResearchPlanId"], message: "Authority Research Plan identity must match the artifact identity." });
  const covered = new Set(plan.operations.filter((operation) => operation.layer === "EVIDENTIARY_CORE").flatMap((operation) => operation.researchQuestionIds));
  for (const questionId of plan.coveredCriticalQuestionIds) if (!covered.has(questionId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["operations"], message: `Critical question ${questionId} lacks an evidentiary-core operation.` });
  const coveredObligations = new Set(plan.operations.filter((operation) => operation.layer === "EVIDENTIARY_CORE").flatMap((operation) => operation.routingObligationIds));
  for (const obligationId of plan.coveredRoutingObligationIds) if (!coveredObligations.has(obligationId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["operations"], message: `Routing obligation ${obligationId} lacks an evidentiary-core operation.` });
});

export const controlledResearchOperationSchema = z.object({
  operationId: idSchema,
  researchQuestionIds: ids(120, 1),
  authorityBindingId: idSchema.nullable(),
  layer: z.enum(["ORIENTATION", "EVIDENTIARY_CORE", "GAP_CONTEST_ESCALATION"]),
  mechanism: institutionalDiscoveryMechanismSchema,
  endpoint: httpsUrlSchema,
  specialistCollectionProfileId: idSchema.nullable(),
  attemptOrder: z.number().int().nonnegative().max(12),
  purpose: boundedText(10, 1000),
  status: z.enum(["PLANNED", "SUCCEEDED", "FAILED", "NOT_AUTHORIZED"]),
  returnedUrls: z.array(httpsUrlSchema).max(60).refine(unique),
  providerInternalQueries: strings(40, 500),
  latencyMs: z.number().int().nonnegative().max(1_200_000).nullable(),
  failureReason: boundedText(3, 1000).nullable()
}).strict().superRefine((operation, context) => {
  if (operation.mechanism !== "GOOGLE_GROUNDING_ESCALATION" && operation.authorityBindingId === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["authorityBindingId"], message: "Institutional operations require a registered authority binding." });
  if (operation.layer !== "GAP_CONTEST_ESCALATION" && operation.mechanism === "GOOGLE_GROUNDING_ESCALATION") context.addIssue({ code: z.ZodIssueCode.custom, path: ["mechanism"], message: "Google Grounding is escalation-only." });
});

export const controlledResearchLedgerSchema = z.object({
  ...immutableEnvelopeFields,
  controlledResearchLedgerId: idSchema,
  topicAuthoritySetId: idSchema,
  budget: controlledResearchBudgetSchema,
  operations: z.array(controlledResearchOperationSchema).max(25),
  gapRepairOperationCount: z.number().int().nonnegative().max(5),
  groundingEscalationCallCount: z.number().int().nonnegative().max(2),
  directRetrievalCount: z.number().int().nonnegative().max(40)
}).strict().superRefine((ledger, context) => {
  const gapCount = ledger.operations.filter((operation) => operation.layer === "GAP_CONTEST_ESCALATION").length;
  const groundingCount = ledger.operations.filter((operation) => operation.mechanism === "GOOGLE_GROUNDING_ESCALATION").length;
  if (ledger.operations.length > ledger.budget.maximumControlledDiscoveryOperations) context.addIssue({ code: z.ZodIssueCode.custom, path: ["operations"], message: "Controlled discovery operation budget exceeded." });
  if (ledger.gapRepairOperationCount !== gapCount) context.addIssue({ code: z.ZodIssueCode.custom, path: ["gapRepairOperationCount"], message: "Gap-operation counter does not match the ledger." });
  if (ledger.groundingEscalationCallCount !== groundingCount) context.addIssue({ code: z.ZodIssueCode.custom, path: ["groundingEscalationCallCount"], message: "Grounding counter does not match the ledger." });
});

export const perspectiveAuditSchema = z.object({
  ...immutableEnvelopeFields,
  perspectiveAuditId: idSchema,
  topicAuthoritySetId: idSchema,
  contested: z.boolean(),
  representedPerspectiveTags: strings(40, 160),
  missingPerspectiveTags: strings(40, 160),
  independentGroupCount: z.number().int().nonnegative().max(24),
  hasIndependentScholarship: z.boolean(),
  onlySelfInterestedEvidence: z.boolean(),
  verdict: z.enum(["SUFFICIENT", "INADEQUATE", "REVIEW_REQUIRED"]),
  reasonCodes: z.array(z.enum(["PERSPECTIVE_REQUIREMENTS_MET", "MISSING_REQUIRED_PERSPECTIVE", "INSUFFICIENT_INDEPENDENCE", "ONLY_SELF_INTERESTED_EVIDENCE", "CONTESTED_HUMAN_REVIEW"])).min(1).max(8).refine(unique)
}).strict();

export const acquisitionConfidenceVectorSchema = z.object({
  ...immutableEnvelopeFields,
  confidenceVectorId: idSchema,
  topicAuthoritySetId: idSchema,
  authorityApplicability: z.enum(["PASS", "FAIL"]),
  evidenceDirectness: z.enum(["PASS", "QUALIFIED", "FAIL"]),
  independentCorroboration: z.enum(["PASS", "QUALIFIED", "FAIL"]),
  perspectiveAdequacy: z.enum(["PASS", "REVIEW_REQUIRED", "FAIL"]),
  conflictStatus: z.enum(["PASS", "QUALIFIED", "REVIEW_REQUIRED", "FAIL"]),
  coverageCompleteness: z.enum(["PASS", "FAIL"]),
  temporalPrecision: z.enum(["PASS", "QUALIFIED", "FAIL"]),
  provenanceIntegrity: z.enum(["PASS", "FAIL"]),
  verdict: z.enum(["PASS", "QUALIFIED", "REVIEW_REQUIRED", "FAIL"]),
  reasonCodes: strings(30, 160)
}).strict();

export const escalationDecisionSchema = z.object({
  ...immutableEnvelopeFields,
  escalationDecisionId: idSchema,
  topicAuthoritySetId: idSchema,
  researchQuestionIds: ids(120, 1),
  gapIds: ids(200, 1),
  reason: z.enum(["MATERIAL_COVERAGE_GAP", "PERSPECTIVE_GAP", "UNRESOLVED_CONFLICT", "AUTHORITY_INACCESSIBLE", "MISSING_INDEPENDENT_CORROBORATION"]),
  mappedAuthorityOperationsAttempted: z.number().int().positive().max(25),
  remainingGapOperations: z.number().int().positive().max(5),
  allowedPurpose: boundedText(10, 1000),
  state: z.literal("AUTHORIZED")
}).strict();

export type AuthorityFamily = z.infer<typeof authorityFamilySchema>;
export type SpecialistCollectionProfile = z.infer<typeof specialistCollectionProfileSchema>;
export type AuthorityRegistryCapability = z.infer<typeof authorityRegistryCapabilitySchema>;
export type AuthorityResearchRole = z.infer<typeof authorityResearchRoleSchema>;
export type SubjectRelationship = z.infer<typeof subjectRelationshipSchema>;
export type TopicAuthorityProposal = Omit<z.infer<typeof topicAuthorityProposalSchema>, "routingObligationIds" | "historicalJurisdictionCapacityIds" | "affectedCommunityEvidenceCapacityIds"> & { routingObligationIds: string[]; historicalJurisdictionCapacityIds?: string[]; affectedCommunityEvidenceCapacityIds?: string[] };
export type TopicAuthorityBinding = Omit<z.infer<typeof topicAuthorityBindingSchema>, "routingObligationIds" | "historicalJurisdictionCapacityIds" | "affectedCommunityEvidenceCapacityIds" | "historicalJurisdictionCapacities" | "affectedCommunityEvidenceCapacities"> & { routingObligationIds: string[]; historicalJurisdictionCapacityIds?: string[]; affectedCommunityEvidenceCapacityIds?: string[]; historicalJurisdictionCapacities?: HistoricalJurisdictionCapacity[]; affectedCommunityEvidenceCapacities?: AffectedCommunityEvidenceCapacity[] };
export type TopicAuthoritySet = Omit<z.infer<typeof topicAuthoritySetSchema>, "bindings"> & { bindings: TopicAuthorityBinding[] };
export type RoutingObligation = z.infer<typeof routingObligationSchema>;
export type RoutingObligationSet = z.infer<typeof routingObligationSetSchema>;
export type ControlledResearchBudget = z.infer<typeof controlledResearchBudgetSchema>;
export type AuthorityResearchPlan = Omit<z.infer<typeof authorityResearchPlanSchema>, "operations"> & { operations: Array<Omit<z.infer<typeof authorityResearchPlanOperationSchema>, "routingObligationIds"> & { routingObligationIds: string[] }> };
export type ControlledResearchOperation = z.infer<typeof controlledResearchOperationSchema>;
export type PerspectiveAudit = z.infer<typeof perspectiveAuditSchema>;
export type AcquisitionConfidenceVector = z.infer<typeof acquisitionConfidenceVectorSchema>;
