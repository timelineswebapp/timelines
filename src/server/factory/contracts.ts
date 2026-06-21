export type FactoryObjectType =
  | "candidate_historical_object"
  | "candidate_milestone"
  | "candidate_participation"
  | "candidate_relationship"
  | "candidate_source"
  | "candidate_context_record";

export type FactoryObjectLifecycle =
  | "draft"
  | "researching"
  | "validated"
  | "validation_failed"
  | "package_candidate"
  | "packaged"
  | "submitted_to_governance"
  | "returned_for_revision"
  | "superseded"
  | "preserved";

export type FactoryArtifactType = "validation" | "evidence" | "enrichment" | "generation" | "audit";

export type FactoryPackageType =
  | "historical_object_publication"
  | "participation_publication"
  | "timeline_context_publication"
  | "mixed_authority_publication";

export type FactoryPackageDraftLifecycle =
  | "draft"
  | "validating"
  | "ready_for_governance"
  | "submitted_to_governance"
  | "returned_for_revision"
  | "revised"
  | "superseded"
  | "preserved";

export type FactoryPackageVersionLifecycle =
  | "draft"
  | "submitted_to_governance"
  | "returned_for_revision"
  | "superseded"
  | "preserved";

export type FactoryFeedbackLifecycle =
  | "received"
  | "acknowledged"
  | "triaged"
  | "revision_required"
  | "revision_in_progress"
  | "resubmission_prepared"
  | "resolved"
  | "closed"
  | "preserved";

export type FactoryRevisionPlanLifecycle =
  | "draft"
  | "approved"
  | "in_progress"
  | "resubmission_prepared"
  | "resolved"
  | "closed"
  | "preserved";

export type FactoryActor = {
  actorId: string;
  role: "factory_editor";
  institutionId: string;
};

export type FactoryObject = {
  objectId: string;
  objectType: FactoryObjectType;
  title: string;
  payload: Record<string, unknown>;
  lifecycle: FactoryObjectLifecycle;
  provenance: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FactoryArtifact = {
  artifactId: string;
  factoryObjectId: string | null;
  artifactType: FactoryArtifactType;
  title: string;
  payload: Record<string, unknown>;
  authoritySafe: boolean;
  modelProvider: string | null;
  modelName: string | null;
  createdBy: string;
  createdAt?: string;
};

export type FactoryPackageRiskSummary = {
  unresolvedAuthorityRisks: string[];
  validationWarnings: string[];
  publicationBlockers: string[];
};

export type FactoryPackageDraft = {
  packageDraftId: string;
  title: string;
  description: string;
  packageType: FactoryPackageType;
  factoryObjectRefs: string[];
  artifactRefs: string[];
  riskSummary: FactoryPackageRiskSummary;
  lifecycle: FactoryPackageDraftLifecycle;
  lineageRootId: string | null;
  supersedesPackageId: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FactoryPackageVersion = {
  packageVersionId: string;
  draftId: string;
  lineageRootId: string;
  version: number;
  supersedesVersionId: string | null;
  packageSnapshot: Record<string, unknown>;
  snapshotHash: string;
  lifecycle: FactoryPackageVersionLifecycle;
  governancePublicationPackageId: string | null;
  feedbackPackageRefs: string[];
  revisionPlanId: string | null;
  sourceFeedbackPackageId: string | null;
  resubmissionAuditRecordId: string | null;
  createdBy: string;
  createdAt?: string;
  submittedAt?: string | null;
};

export type FactoryFeedbackConsumption = {
  feedbackConsumptionId: string;
  feedbackPackageId: string;
  governancePublicationPackageId: string | null;
  factoryPackageVersionId: string | null;
  factoryPackageDraftId: string | null;
  factoryLineageRootId: string | null;
  affectedFactoryObjectIds: string[];
  classification:
    | "authority_error"
    | "missing_context"
    | "participation_error"
    | "priority_error"
    | "source_gap"
    | "publication_quality_issue"
    | "audit_gap";
  requiredResponse:
    | "factory_acknowledgement"
    | "factory_revision"
    | "governance_review"
    | "new_publication_package"
    | "no_action_required";
  lifecycle: FactoryFeedbackLifecycle;
  revisionPlanId: string | null;
  resolutionRecordId: string | null;
  auditRecordId: string;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FactoryRevisionPlan = {
  revisionPlanId: string;
  feedbackConsumptionId: string;
  feedbackPackageId: string;
  factoryPackageVersionId: string | null;
  factoryPackageDraftId: string | null;
  factoryLineageRootId: string | null;
  affectedFactoryObjectIds: string[];
  planSummary: string;
  plannedActions: string[];
  lifecycle: FactoryRevisionPlanLifecycle;
  resubmissionPackageDraftId: string | null;
  supersededPackageVersionId: string | null;
  newPackageVersionId: string | null;
  governancePublicationPackageId: string | null;
  submissionAuditRecordId: string | null;
  revisionCompletionRecordId: string | null;
  auditRecordId: string;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};
