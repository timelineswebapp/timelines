import { z } from "zod";
import { slugify } from "@/src/lib/utils";

const trimmedString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max);

const nullableTrimmedString = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => value || null);

const nullableCredibilityScore = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    return value;
  })
  .refine((value) => value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1), {
    message: "Credibility score must be between 0 and 1."
  });

export const datePrecisionSchema = z.enum(["year", "month", "day", "approximate"]);
export const timelineOrderingModeSchema = z.enum(["chronology", "editorial"]);
export const importFormatSchema = z.enum(["csv", "json", "text"]);
export const importTypeSchema = z.enum(["timeline_with_events", "events_into_existing_timeline"]);
export const requestStatusSchema = z.enum(["pending", "reviewed", "planned", "rejected", "completed"]);
export const timelineRequestTypeSchema = z.enum(["timeline_request", "general_contact", "timeline_proposal", "timeline_correction"]);
export const adSlotSchema = z.enum([
  "home_feed_ad",
  "timeline_inline_1",
  "timeline_inline_2",
  "timeline_bottom",
  "search_bottom"
]);
export const adCampaignStatusSchema = z.enum(["draft", "active", "paused", "completed"]);
export const historicalObjectTypeSchema = z.enum([
  "person",
  "institution",
  "place",
  "technology",
  "publication",
  "conflict",
  "movement",
  "period"
]);
export const participationPrioritySchema = z.enum(["PRIMARY", "SUPPORTING", "CONTEXT", "BACKGROUND"]);
export const uuidParamSchema = z.string().trim().uuid();

const actorSchema = z.string().trim().min(2).max(120).default("admin");
const provenanceSchema = z.record(z.unknown()).default({});
const governanceDecisionIdSchema = z.string().trim().uuid();

export const sourceSchema = z.object({
  publisher: trimmedString(2, 120),
  url: z.string().trim().url(),
  credibilityScore: z.coerce.number().min(0).max(1)
});

export const embeddedSourceSchema = z.object({
  title: trimmedString(2, 160),
  url: z.string().trim().url(),
  publisher: z.string().trim().max(120).nullish().transform((value) => value || null)
});

export const tagSchema = z.object({
  name: trimmedString(2, 60),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value, ctx) => {
      const computed = slugify(value || "");
      if (!computed) {
        ctx.addIssue({
          code: "custom",
          message: "Slug is required."
        });
        return z.NEVER;
      }

      return computed;
    })
});

export const eventSchema = z.object({
  date: z.string().trim().min(1).max(40),
  datePrecision: datePrecisionSchema,
  title: trimmedString(3, 160),
  description: trimmedString(10, 2000),
  importance: z.coerce.number().int().min(1).max(5),
  location: z.string().trim().max(120).nullable().optional().transform((value) => value || null),
  imageUrl: z.string().trim().url().nullable().optional().transform((value) => value || null),
  timelineId: z.coerce.number().int().positive(),
  eventOrder: z.coerce.number().int().min(1),
  sources: z.array(embeddedSourceSchema).max(20).default([]),
  tagIds: z.array(z.coerce.number().int().positive()).max(20).default([])
});

export const timelineSchema = z.object({
  title: trimmedString(3, 140),
  slug: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value, ctx) => {
      const computed = slugify(value || "");
      if (!computed) {
        ctx.addIssue({
          code: "custom",
          message: "Slug is required."
        });
        return z.NEVER;
      }

      return computed;
  }),
  description: trimmedString(20, 800),
  category: trimmedString(2, 80),
  orderingMode: timelineOrderingModeSchema.default("chronology")
});

const requestLanguageSchema = z.string().trim().min(2).max(20).default("en");
const requestEmailSchema = z.string().trim().email().max(254);
const requestMetadataSchema = z.record(z.unknown()).default({});

const timelineRequestPayloadSchema = z.discriminatedUnion("requestType", [
  z.object({
    requestType: z.literal("timeline_request"),
    query: trimmedString(3, 120),
    language: requestLanguageSchema,
    metadata: requestMetadataSchema
  }),
  z.object({
    requestType: z.literal("general_contact"),
    query: trimmedString(3, 160).default("General contact"),
    language: requestLanguageSchema,
    email: requestEmailSchema,
    message: trimmedString(3, 5000),
    metadata: requestMetadataSchema
  }),
  z.object({
    requestType: z.literal("timeline_proposal"),
    query: trimmedString(3, 240),
    language: requestLanguageSchema,
    email: requestEmailSchema,
    message: trimmedString(3, 5000),
    sourcesScope: trimmedString(3, 5000),
    metadata: requestMetadataSchema
  }),
  z.object({
    requestType: z.literal("timeline_correction"),
    query: trimmedString(3, 240),
    language: requestLanguageSchema,
    email: requestEmailSchema,
    targetTimeline: trimmedString(3, 500),
    message: trimmedString(3, 5000),
    metadata: requestMetadataSchema
  })
]);

export const timelineRequestSchema = z.preprocess((value) => {
  if (value && typeof value === "object" && !("requestType" in value)) {
    return { ...(value as Record<string, unknown>), requestType: "timeline_request" };
  }

  return value;
}, timelineRequestPayloadSchema);

export const requestStatusUpdateSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: requestStatusSchema
});

export const searchQuerySchema = z.object({
  q: trimmedString(1, 120),
  limit: z.coerce.number().int().min(1).max(20).default(12)
});

export const timelineViewTelemetrySchema = z.object({
  timelineId: z.coerce.number().int().positive(),
  slug: z.string().trim().min(1).max(160)
});

export const importRowSchema = z.object({
  date: z.string().trim().min(1).max(40),
  datePrecision: datePrecisionSchema.optional(),
  eventOrder: z.coerce.number().int().min(1).optional(),
  title: trimmedString(3, 160),
  description: trimmedString(10, 2000),
  importance: z.coerce.number().int().min(1).max(5),
  location: z.string().trim().max(120).nullish(),
  imageUrl: z.string().trim().url().nullish(),
  sources: z.array(
    z.object({
      publisher: nullableTrimmedString(120),
      url: z.string().trim().url(),
      credibilityScore: nullableCredibilityScore
    })
  ).max(20).default([]),
  tags: z.array(trimmedString(1, 60)).max(20).default([])
});

export const importTimelineSchema = z.object({
  title: trimmedString(3, 140),
  slug: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value, ctx) => {
      if (!value) {
        return undefined;
      }

      const computed = slugify(value);
      if (!computed) {
        ctx.addIssue({
          code: "custom",
          message: "Slug is invalid."
        });
        return z.NEVER;
      }

      return computed;
    }),
  description: trimmedString(20, 800),
  category: trimmedString(2, 80)
});

export const importPreviewSchema = z.object({
  format: importFormatSchema,
  importType: importTypeSchema,
  content: z.string().min(2).max(500000),
  timelineId: z.coerce.number().int().positive().nullable().optional(),
  skipDuplicates: z.coerce.boolean().default(true)
});

export const adCampaignSchema = z.object({
  slot: adSlotSchema,
  campaignName: trimmedString(3, 140),
  advertiser: trimmedString(2, 120),
  creativeImage: z.string().trim().url().nullable().optional().transform((value) => value || null),
  headline: trimmedString(3, 140),
  description: trimmedString(10, 400),
  cta: trimmedString(2, 40),
  targetUrl: z.string().trim().url(),
  startDate: z.string().trim().date(),
  endDate: z.string().trim().date(),
  status: adCampaignStatusSchema
});

export const historicalObjectSchema = z.object({
  canonicalName: trimmedString(2, 180),
  canonicalSlug: z.string().trim().max(200).optional(),
  primaryType: historicalObjectTypeSchema,
  description: z.string().trim().max(2000).default(""),
  aliases: z.array(trimmedString(2, 180)).max(25).default([]),
  provenance: provenanceSchema,
  actor: actorSchema,
  reason: trimmedString(3, 1000),
  governanceDecisionId: governanceDecisionIdSchema
});

export const historicalObjectRevisionSchema = historicalObjectSchema
  .omit({ aliases: true })
  .extend({
    reason: trimmedString(3, 1000)
  });

export const historicalObjectMergeSchema = z.object({
  targetObjectId: z.string().trim().uuid(),
  reason: trimmedString(3, 1000),
  provenance: provenanceSchema,
  actor: actorSchema,
  governanceDecisionId: governanceDecisionIdSchema
});

export const historicalObjectRetirementSchema = z.object({
  reason: trimmedString(3, 1000),
  provenance: provenanceSchema,
  actor: actorSchema,
  governanceDecisionId: governanceDecisionIdSchema
});

export const milestoneParticipationSchema = z.object({
  historicalObjectId: z.string().trim().uuid(),
  milestoneId: z.coerce.number().int().positive(),
  role: trimmedString(2, 120),
  summary: trimmedString(10, 2000),
  participationPriority: participationPrioritySchema.default("SUPPORTING"),
  provenance: provenanceSchema,
  actor: actorSchema,
  reason: trimmedString(3, 1000),
  governanceDecisionId: governanceDecisionIdSchema
});

export const milestoneParticipationRevisionSchema = milestoneParticipationSchema.omit({
  historicalObjectId: true,
  milestoneId: true
});

export const milestoneParticipationDisputeSchema = z.object({
  reason: trimmedString(3, 1000),
  provenance: provenanceSchema,
  actor: actorSchema,
  governanceDecisionId: governanceDecisionIdSchema
});

const governanceRoleSchema = z.enum([
  "factory_editor",
  "governance_reviewer",
  "senior_governance_reviewer",
  "library_editor",
  "registry_operator",
  "auditor"
]);

const governanceServiceBoundarySchema = z.enum(["factory", "governance", "historical_library", "registry", "platform"]);
const authorityRefSchema = z.object({
  authorityType: z.enum(["historical_object", "participation", "relationship", "publication_package", "feedback_package", "dispute"]),
  authorityId: trimmedString(1, 160)
});
const governanceActorRefSchema = z.object({
  actorId: trimmedString(2, 120),
  role: governanceRoleSchema,
  institutionId: trimmedString(2, 120)
});
const evidenceRefSchema = z.object({
  evidenceId: trimmedString(1, 160),
  evidenceType: z.enum(["validated_evidence", "source", "factory_validation", "library_review", "audit_record", "dispute_submission", "governance_note"]),
  evidenceRecordId: governanceDecisionIdSchema.optional(),
  validationRecordId: governanceDecisionIdSchema.optional(),
  uri: z.string().trim().url().optional(),
  authoritySafe: z.boolean()
});

const relationshipTypeSchema = z.enum([
  "influences",
  "influenced_by",
  "member_of",
  "contains",
  "located_in",
  "succeeds",
  "preceded_by",
  "owns",
  "owned_by",
  "related_to"
]);

export const historicalRelationshipSchema = z.object({
  sourceAuthorityRef: authorityRefSchema,
  targetAuthorityRef: authorityRefSchema,
  relationshipType: relationshipTypeSchema,
  summary: trimmedString(3, 2000),
  evidenceRefs: z.array(evidenceRefSchema).max(50).default([]),
  provenance: provenanceSchema,
  actor: actorSchema,
  reason: trimmedString(3, 1000),
  governanceDecisionId: governanceDecisionIdSchema
});

export const historicalRelationshipRevisionSchema = historicalRelationshipSchema;

export const historicalRelationshipMergeSchema = z.object({
  targetRelationshipId: governanceDecisionIdSchema,
  continuityPath: z.record(z.unknown()).default({}),
  reason: trimmedString(3, 1000),
  provenance: provenanceSchema,
  actor: actorSchema,
  governanceDecisionId: governanceDecisionIdSchema
});

export const historicalRelationshipActionSchema = z.object({
  reason: trimmedString(3, 1000),
  continuityPath: z.record(z.unknown()).default({}),
  provenance: provenanceSchema,
  actor: actorSchema,
  governanceDecisionId: governanceDecisionIdSchema
});

export const governanceDecisionSchema = z.object({
  decisionId: governanceDecisionIdSchema,
  decisionType: z.enum([
    "ADMIT_HISTORICAL_OBJECT",
    "REVISE_HISTORICAL_OBJECT",
    "MERGE_HISTORICAL_OBJECT",
    "RETIRE_HISTORICAL_OBJECT",
    "PRESERVE_HISTORICAL_OBJECT",
    "ADMIT_PARTICIPATION",
    "REVISE_PARTICIPATION",
    "CHANGE_PARTICIPATION_PRIORITY",
    "RETIRE_PARTICIPATION",
    "ADMIT_RELATIONSHIP",
    "REVISE_RELATIONSHIP",
    "RETIRE_RELATIONSHIP",
    "MERGE_RELATIONSHIP",
    "PRESERVE_RELATIONSHIP",
    "CERTIFY_PUBLICATION_READINESS",
    "ACCEPT_PUBLICATION_PACKAGE",
    "REJECT_PUBLICATION_PACKAGE",
    "RETURN_PUBLICATION_PACKAGE",
    "CREATE_FEEDBACK_PACKAGE",
    "CLOSE_FEEDBACK_PACKAGE",
    "OPEN_DISPUTE",
    "RESOLVE_DISPUTE",
    "ESCALATE_AUTHORITY_REVIEW"
  ]),
  targetAuthority: authorityRefSchema,
  actor: governanceActorRefSchema,
  evidenceRefs: z.array(evidenceRefSchema).max(50).default([]),
  rationale: z.object({
    summary: trimmedString(3, 2000),
    authorityBasis: z.array(trimmedString(1, 240)).min(1).max(25),
    riskNotes: z.array(trimmedString(1, 500)).max(25).optional()
  }),
  approvalRefs: z.array(governanceDecisionIdSchema).max(25).default([]),
  escalationRefs: z.array(governanceDecisionIdSchema).max(25).default([]),
  outcome: z.enum(["approved", "rejected", "returned_for_revision", "escalated", "superseded", "no_action"]),
  lifecycle: z.enum(["draft", "submitted", "under_review", "approval_pending", "approved", "rejected", "returned_for_revision", "escalated", "superseded", "preserved"])
});

export const approvalSchema = z.object({
  approvalId: governanceDecisionIdSchema,
  decisionId: governanceDecisionIdSchema,
  request: z.object({
    requestedBy: governanceActorRefSchema,
    requestedRole: governanceRoleSchema,
    targetAuthority: authorityRefSchema,
    reason: trimmedString(3, 1000)
  }),
  steps: z.array(
    z.object({
      stepId: governanceDecisionIdSchema,
      sequence: z.coerce.number().int().positive(),
      requiredRole: governanceRoleSchema,
      approver: governanceActorRefSchema.optional(),
      outcome: z.enum(["approved", "rejected", "returned_for_revision", "escalated"]).optional(),
      reason: z.string().trim().max(1000).optional(),
      decidedAt: z.string().trim().datetime().optional()
    })
  ).min(1).max(20),
  lifecycle: z.enum(["requested", "pending", "partially_approved", "approved", "rejected", "returned_for_revision", "escalated", "expired", "preserved"])
});

export const governanceQueueSchema = z.object({
  queueId: governanceDecisionIdSchema,
  queueType: z.enum([
    "object_intake",
    "object_validation",
    "participation_intake",
    "participation_priority_review",
    "publication_readiness",
    "library_review",
    "feedback_return",
    "dispute_triage",
    "escalation_review",
    "audit_review"
  ]),
  ownerService: governanceServiceBoundarySchema,
  ownerRole: governanceRoleSchema,
  targetAuthority: authorityRefSchema,
  allowedActions: z.array(z.enum(["submit", "validate", "request_revision", "approve", "reject", "escalate", "certify_ready", "accept", "return_to_factory", "close", "preserve"])).min(1).max(20),
  decisionRefs: z.array(governanceDecisionIdSchema).max(25).default([]),
  auditRefs: z.array(governanceDecisionIdSchema).max(25).default([]),
  lifecycle: z.enum(["entered", "in_review", "blocked", "exited", "preserved"])
});

export const publicationPackageSchema = z.object({
  packageId: governanceDecisionIdSchema,
  scope: z.object({
    packageType: z.enum(["historical_object_publication", "participation_publication", "relationship_publication", "timeline_context_publication", "mixed_authority_publication"]),
    description: trimmedString(3, 1000)
  }),
  includedAuthority: z.array(authorityRefSchema).min(1).max(100),
  validationArtifacts: z.array(evidenceRefSchema).max(100).default([]),
  decisionRefs: z.array(governanceDecisionIdSchema).max(50).default([]),
  riskSummary: z.object({
    unresolvedAuthorityRisks: z.array(trimmedString(1, 500)).max(50).default([]),
    disputeRefs: z.array(governanceDecisionIdSchema).max(50).default([]),
    validationWarnings: z.array(trimmedString(1, 500)).max(50).default([]),
    publicationBlockers: z.array(trimmedString(1, 500)).max(50).default([])
  }),
  readinessCertification: z.object({
    certifiedBy: governanceActorRefSchema,
    decisionId: governanceDecisionIdSchema,
    readinessStatus: z.enum(["ready", "blocked", "conditional"])
  }).optional(),
  acceptanceOutcome: z.enum(["accepted", "rejected", "returned_for_revision", "accepted_with_notes"]).optional(),
  lifecycle: z.enum(["factory_draft", "factory_validating", "factory_ready", "governance_review", "readiness_certified", "library_review", "accepted", "rejected", "returned_for_revision", "published", "preserved"])
});

export const feedbackPackageSchema = z.object({
  feedbackPackageId: governanceDecisionIdSchema,
  origin: z.object({
    originService: z.enum(["historical_library", "governance", "audit"]),
    originActor: governanceActorRefSchema,
    sourcePackageId: governanceDecisionIdSchema.optional()
  }),
  affectedAuthority: z.array(authorityRefSchema).min(1).max(100),
  correctionClass: z.enum(["authority_error", "missing_context", "participation_error", "priority_error", "source_gap", "publication_quality_issue", "audit_gap"]),
  evidence: z.array(evidenceRefSchema).max(100).default([]),
  requiredResponse: z.enum(["factory_acknowledgement", "factory_revision", "governance_review", "new_publication_package", "no_action_required"]),
  severity: z.enum(["low", "medium", "high", "blocking"]),
  closureRequirements: z.array(trimmedString(1, 500)).max(50).default([]),
  lifecycle: z.enum(["created", "delivered_to_factory", "acknowledged", "factory_reviewing", "action_required", "informational", "resolved", "closed", "preserved"])
});

export const disputeSchema = z.object({
  disputeId: governanceDecisionIdSchema,
  targetAuthority: authorityRefSchema,
  disputeClass: z.enum(["identity_conflict", "chronology_conflict", "participation_conflict", "priority_conflict", "source_conflict", "publication_conflict", "governance_process_conflict"]),
  evidenceBundle: z.array(evidenceRefSchema).max(100).default([]),
  severity: z.enum(["minor", "material", "high", "blocking"]),
  resolutionPath: z.enum(["standard_review", "senior_review", "library_review", "factory_revision", "audit_review"]),
  outcome: z.enum(["upheld", "rejected", "amended", "merged", "retired", "returned_for_revision"]).optional(),
  lifecycle: z.enum(["raised", "triaged", "evidence_gathering", "review_pending", "escalated", "resolved_upheld", "resolved_rejected", "resolved_amended", "closed", "preserved"])
});

export const auditRecordSchema = z.object({
  auditRecordId: governanceDecisionIdSchema,
  authorityRef: authorityRefSchema,
  decisionRefs: z.array(governanceDecisionIdSchema).min(1).max(100),
  approvalRefs: z.array(governanceDecisionIdSchema).max(100).default([]),
  evidenceRefs: z.array(trimmedString(1, 160)).max(100).default([]),
  packageRefs: z.array(governanceDecisionIdSchema).max(100).default([]),
  disputeRefs: z.array(governanceDecisionIdSchema).max(100).default([]),
  finalState: trimmedString(1, 160),
  reconstruction: z.object({
    actorChain: z.array(governanceActorRefSchema).min(1).max(100),
    stateTransitions: z.array(z.object({
      fromState: trimmedString(1, 120),
      toState: trimmedString(1, 120),
      changedBy: governanceActorRefSchema,
      decisionId: governanceDecisionIdSchema.optional(),
      approvalId: governanceDecisionIdSchema.optional(),
      reason: trimmedString(3, 1000),
      changedAt: z.string().trim().datetime().optional()
    })).min(1).max(200)
  })
});

export const governanceTransitionSchema = z.object({
  actor: governanceActorRefSchema,
  reason: trimmedString(3, 1000),
  governanceDecisionId: governanceDecisionIdSchema.optional()
});

export const historicalLibraryAdmissionSchema = z.object({
  actor: governanceActorRefSchema,
  reason: trimmedString(3, 1000),
  governanceDecisionId: governanceDecisionIdSchema,
  requestedByService: governanceServiceBoundarySchema.default("historical_library"),
  auditRefs: z.array(governanceDecisionIdSchema).max(100).default([])
});

const historicalLibraryLifecycleBaseSchema = z.object({
  publicationPackageId: governanceDecisionIdSchema,
  governanceDecisionId: governanceDecisionIdSchema,
  actor: governanceActorRefSchema,
  reason: trimmedString(3, 1000),
  auditRecordId: governanceDecisionIdSchema.nullable().optional()
});

export const historicalLibraryRevisionSchema = historicalLibraryLifecycleBaseSchema.extend({
  revisedSnapshot: z.record(z.unknown()),
  amendmentSummary: trimmedString(3, 2000)
});

export const historicalLibraryRetirementSchema = historicalLibraryLifecycleBaseSchema.extend({
  continuityPath: z.record(z.unknown()).default({})
});

export const historicalLibraryMergeSchema = historicalLibraryLifecycleBaseSchema.extend({
  targetPublishedRecordId: governanceDecisionIdSchema,
  continuityPath: z.record(z.unknown()).default({})
});

export const historicalLibraryPreservationSchema = historicalLibraryLifecycleBaseSchema.extend({
  preservationMetadata: z.record(z.unknown()).default({})
});

export const historicalLibraryFeedbackGenerationSchema = z.object({
  lifecycleActionType: z.enum(["revision", "retirement", "merge", "preservation"]),
  lifecycleActionId: governanceDecisionIdSchema,
  publicationPackageId: governanceDecisionIdSchema,
  sourcePublishedRecordId: governanceDecisionIdSchema,
  targetPublishedRecordId: governanceDecisionIdSchema.nullable().optional(),
  governanceDecisionId: governanceDecisionIdSchema,
  actor: governanceActorRefSchema,
  affectedAuthority: z.array(authorityRefSchema).min(1).max(100),
  correctionClass: z.enum(["authority_error", "missing_context", "participation_error", "priority_error", "source_gap", "publication_quality_issue", "audit_gap"]),
  evidence: z.array(evidenceRefSchema).max(100).default([]),
  requiredResponse: z.enum(["factory_acknowledgement", "factory_revision", "governance_review", "new_publication_package", "no_action_required"]),
  severity: z.enum(["low", "medium", "high", "blocking"]),
  closureRequirements: z.array(trimmedString(1, 500)).max(50).default([]),
  reason: trimmedString(3, 1000)
});

export const factoryObjectLifecycleSchema = z.enum([
  "draft",
  "researching",
  "validated",
  "validation_failed",
  "package_candidate",
  "packaged",
  "submitted_to_governance",
  "returned_for_revision",
  "superseded",
  "preserved"
]);

export const factoryPackageDraftLifecycleSchema = z.enum([
  "draft",
  "validating",
  "ready_for_governance",
  "submitted_to_governance",
  "returned_for_revision",
  "revised",
  "superseded",
  "preserved"
]);

export const factoryFeedbackLifecycleSchema = z.enum([
  "received",
  "acknowledged",
  "triaged",
  "revision_required",
  "revision_in_progress",
  "resubmission_prepared",
  "resolved",
  "closed",
  "preserved"
]);

export const factoryObjectSchema = z.object({
  objectType: z.enum([
    "candidate_historical_object",
    "candidate_milestone",
    "candidate_participation",
    "candidate_relationship",
    "candidate_source",
    "candidate_context_record"
  ]),
  title: trimmedString(2, 200),
  payload: z.record(z.unknown()),
  provenance: provenanceSchema,
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryArtifactSchema = z.object({
  factoryObjectId: z.string().trim().uuid().nullable().optional(),
  artifactType: z.enum(["validation", "evidence", "enrichment", "generation", "audit"]),
  title: trimmedString(2, 200),
  payload: z.record(z.unknown()),
  authoritySafe: z.boolean().default(false),
  modelProvider: z.string().trim().max(120).nullable().optional().transform((value) => value || null),
  modelName: z.string().trim().max(120).nullable().optional().transform((value) => value || null),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

const factoryPackageRiskSummarySchema = z.object({
  unresolvedAuthorityRisks: z.array(trimmedString(1, 500)).max(50).default([]),
  validationWarnings: z.array(trimmedString(1, 500)).max(50).default([]),
  publicationBlockers: z.array(trimmedString(1, 500)).max(50).default([])
});

export const factoryPackageDraftSchema = z.object({
  title: trimmedString(2, 200),
  description: trimmedString(10, 2000),
  packageType: z.enum(["historical_object_publication", "participation_publication", "timeline_context_publication", "mixed_authority_publication"]),
  factoryObjectRefs: z.array(z.string().trim().uuid()).min(1).max(100),
  artifactRefs: z.array(z.string().trim().uuid()).max(100).default([]),
  riskSummary: factoryPackageRiskSummarySchema.default({
    unresolvedAuthorityRisks: [],
    validationWarnings: [],
    publicationBlockers: []
  }),
  supersedesPackageId: z.string().trim().uuid().nullable().optional(),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryObjectTransitionSchema = z.object({
  lifecycle: factoryObjectLifecycleSchema,
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryPackageDraftTransitionSchema = z.object({
  lifecycle: factoryPackageDraftLifecycleSchema,
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryPackageVersionSchema = z.object({
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryGovernanceSubmissionSchema = z.object({
  actor: governanceActorRefSchema.refine((actor) => actor.role === "factory_editor", {
    message: "Factory submission actor must have factory_editor role."
  }),
  reason: trimmedString(3, 1000)
});

export const factoryFeedbackIntakeSchema = z.object({
  feedbackPackageId: z.string().trim().uuid(),
  affectedFactoryObjectIds: z.array(z.string().trim().uuid()).max(100).default([]),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryFeedbackTransitionSchema = z.object({
  lifecycle: factoryFeedbackLifecycleSchema,
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryRevisionPlanSchema = z.object({
  planSummary: trimmedString(10, 2000),
  plannedActions: z.array(trimmedString(3, 1000)).min(1).max(100),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryResubmissionPreparationSchema = z.object({
  title: trimmedString(2, 200),
  description: trimmedString(10, 2000),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryResubmissionCompletionSchema = z.object({
  actor: governanceActorRefSchema.refine((actor) => actor.role === "factory_editor", {
    message: "Factory resubmission actor must have factory_editor role."
  }),
  reason: trimmedString(3, 1000)
});

export const factoryRuntimeWorkerSchema = z.object({
  workerKey: trimmedString(2, 120),
  displayName: trimmedString(2, 200),
  description: trimmedString(10, 1000),
  capabilities: z.array(trimmedString(2, 120)).max(50).default([]),
  defaultProviderKey: z.enum(["qwen14"]).default("qwen14"),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryRuntimePromptSchema = z.object({
  promptKey: trimmedString(2, 120),
  title: trimmedString(2, 200),
  template: trimmedString(10, 10000),
  inputSchema: z.record(z.unknown()).default({}),
  outputSchema: z.record(z.unknown()).default({}),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryRuntimeJobSchema = z.object({
  workerId: z.string().trim().uuid(),
  promptId: z.string().trim().uuid(),
  providerKey: z.enum(["qwen14"]).optional(),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  input: z.record(z.unknown()),
  configuration: z.record(z.unknown()).default({}),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryRuntimeJobTransitionSchema = z.object({
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryRuntimeJobExecutionSchema = z.object({
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryWorkerRegistrySyncSchema = z.object({
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryPipelineStartSchema = z.object({
  pipelineId: z.enum(["historical_research_pipeline", "historical_extraction_pipeline", "publication_candidate_pipeline"]),
  input: z.record(z.unknown()).default({}),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryPipelineCancellationSchema = z.object({
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryGovernanceHandoffSchema = z.object({
  pipelineRunId: z.string().trim().uuid().nullable().optional(),
  factoryPackageDraftId: z.string().trim().uuid(),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryGovernanceHandoffSubmissionSchema = z.object({
  actor: governanceActorRefSchema.refine((actor) => actor.role === "factory_editor", {
    message: "Factory handoff actor must have factory_editor role."
  }),
  reason: trimmedString(3, 1000)
});

const editorialEvidenceReviewSchema = z.array(z.record(z.unknown())).min(1).max(200);
const editorialSourceReviewSchema = z.array(z.record(z.unknown())).min(1).max(200);

export const factoryCandidateValidationSchema = z.object({
  factoryPackageDraftId: z.string().trim().uuid(),
  reviewer: actorSchema,
  evidenceReviewed: editorialEvidenceReviewSchema,
  sourcesReviewed: editorialSourceReviewSchema,
  validationSummary: z.object({
    minimumSourceCount: z.coerce.number().int().min(1).max(25),
    minimumEvidenceCount: z.coerce.number().int().min(1).max(100),
    sourceDiversity: z.boolean(),
    dateConsistency: z.boolean(),
    chronologyConsistency: z.boolean(),
    relationshipConsistency: z.boolean(),
    objectIdentityConsistency: z.boolean()
  }),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryCandidateReviewSchema = z.object({
  reviewer: actorSchema,
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryEditorialDecisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    confidence: z.object({
      confidenceLevel: z.enum(["high", "verified"]),
      confidenceScore: z.coerce.number().min(0.75).max(1),
      factors: z.object({
        sourceQuality: z.coerce.number().min(0).max(1),
        sourceCount: z.coerce.number().min(0).max(1),
        evidenceCount: z.coerce.number().min(0).max(1),
        crossSourceAgreement: z.coerce.number().min(0).max(1),
        chronologicalConsistency: z.coerce.number().min(0).max(1)
      })
    }),
    actor: actorSchema,
    reason: trimmedString(3, 1000)
  }),
  z.object({
    decision: z.literal("require_revision"),
    evidenceReviewed: z.array(z.record(z.unknown())).max(200).optional(),
    sourcesReviewed: z.array(z.record(z.unknown())).max(200).optional(),
    actor: actorSchema,
    reason: trimmedString(3, 1000)
  })
]);

export const factoryAuthorityPreparationSchema = z.object({
  editorialReviewId: z.string().trim().uuid(),
  canonicalIdentityMapping: z.record(z.unknown()),
  authorityReferences: z.record(z.unknown()),
  sourceTraceability: z.record(z.unknown()),
  evidenceTraceability: z.record(z.unknown()),
  revisionTraceability: z.record(z.unknown()),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const factoryGovernanceReadinessAssessmentSchema = z.object({
  editorialReviewId: z.string().trim().uuid(),
  actor: actorSchema,
  reason: trimmedString(3, 1000)
});

export const approvalStepTransitionSchema = governanceTransitionSchema.extend({
  stepId: governanceDecisionIdSchema
});

export const disputeResolutionTransitionSchema = governanceTransitionSchema.extend({
  outcome: z.enum(["upheld", "rejected", "amended", "merged", "retired", "returned_for_revision"]),
  governanceDecisionId: governanceDecisionIdSchema
});
