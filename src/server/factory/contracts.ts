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

export type FactoryEditorialReviewLifecycle =
  | "generated"
  | "validated"
  | "under_editorial_review"
  | "revision_required"
  | "editorially_approved"
  | "authority_prepared"
  | "governance_ready"
  | "preserved";

export type FactoryConfidenceLevel = "low" | "medium" | "high" | "verified";

export type FactoryEditorialDecisionType =
  | "validate"
  | "start_review"
  | "approve"
  | "require_revision"
  | "prepare_authority"
  | "assess_governance_ready"
  | "preserve";

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

export type FactoryRuntimeWorkerStatus = "registered" | "disabled";
export type FactoryRuntimeJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type FactoryRuntimeExecutionStatus = "created" | "started" | "completed" | "failed" | "cancelled";
export type FactoryPipelineRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type FactoryPipelineStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
export type FactoryGovernanceHandoffStatus = "prepared" | "submitted_to_governance" | "cancelled" | "preserved";
export type FactoryWorkerCategory = "research" | "source" | "extraction" | "enrichment" | "assembly" | "validation";
export type FactoryWorkerOperation =
  | "read_factory_production_memory"
  | "read_factory_artifacts"
  | "create_candidate_artifacts"
  | "create_validation_artifacts"
  | "create_candidate_objects"
  | "create_candidate_milestones"
  | "create_candidate_participations"
  | "create_candidate_relationships";
export type FactoryWorkerForbiddenOperation =
  | "create_governance_decisions"
  | "approve_packages"
  | "reject_packages"
  | "certify_readiness"
  | "admit_published_memory"
  | "modify_historical_library"
  | "modify_projections"
  | "publish_content"
  | "mutate_public_platform_read_models";

export type FactoryWorkerProviderPolicy = {
  providerId: "qwen14_local";
  providerType: "local_llm";
  status: "active";
  allowedProviderTypes: Array<"local_llm">;
  providerAgnostic: true;
};

export type FactoryWorkerRetryPolicy = {
  maxAttempts: number;
  backoffMs: number;
};

export type FactoryWorkerAuditRequirements = {
  auditInput: boolean;
  auditOutput: boolean;
  auditProvider: boolean;
  auditPolicy: boolean;
};

export type FactoryWorkerContract = {
  worker_id: string;
  worker_name: string;
  worker_version: number;
  worker_category: FactoryWorkerCategory;
  description: string;
  allowed_inputs: string[];
  allowed_outputs: string[];
  output_schema: Record<string, unknown>;
  allowed_object_types: FactoryObjectType[];
  allowed_relationship_types: string[];
  provider_policy: FactoryWorkerProviderPolicy;
  max_context_tokens: number;
  max_output_tokens: number;
  retry_policy: FactoryWorkerRetryPolicy;
  execution_timeout: number;
  audit_requirements: FactoryWorkerAuditRequirements;
  forbidden_operations: FactoryWorkerForbiddenOperation[];
};

export type FactoryWorkerRegistryRecord = {
  workerRegistryId: string;
  workerKey: string;
  workerName: string;
  workerVersion: number;
  workerCategory: FactoryWorkerCategory;
  contract: FactoryWorkerContract;
  policy: Record<string, unknown>;
  permissions: FactoryWorkerOperation[];
  forbiddenOperations: FactoryWorkerForbiddenOperation[];
  providerPolicy: FactoryWorkerProviderPolicy;
  status: "active" | "superseded" | "disabled";
  createdBy: string;
  createdAt?: string;
};

export type FactoryRuntimeWorker = {
  workerId: string;
  workerKey: string;
  displayName: string;
  description: string;
  capabilities: string[];
  defaultProviderKey: string;
  status: FactoryRuntimeWorkerStatus;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FactoryRuntimePrompt = {
  promptId: string;
  promptKey: string;
  version: number;
  title: string;
  template: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  status: "active" | "superseded" | "disabled";
  createdBy: string;
  createdAt?: string;
};

export type FactoryRuntimeJob = {
  jobId: string;
  workerId: string;
  promptId: string;
  providerKey: string;
  modelName: string;
  status: FactoryRuntimeJobStatus;
  priority: number;
  input: Record<string, unknown>;
  configuration: Record<string, unknown>;
  queuedBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FactoryRuntimeExecution = {
  executionId: string;
  jobId: string;
  workerId: string;
  providerKey: string;
  modelName: string;
  status: FactoryRuntimeExecutionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FactoryRuntimeAuditRecord = {
  auditRecordId: string;
  targetRef: {
    authorityType: "factory_runtime_worker" | "factory_runtime_prompt" | "factory_runtime_job" | "factory_runtime_execution";
    authorityId: string;
  };
  action: string;
  actor: string;
  reason: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown>;
  createdAt?: string;
};

export type FactoryRuntimeMetrics = {
  workerCount: number;
  activeWorkerCount: number;
  workerPolicyCount: number;
  workerVersionCount: number;
  workerPermissionCount: number;
  promptCount: number;
  queuedJobCount: number;
  runningJobCount: number;
  completedJobCount: number;
  failedJobCount: number;
  cancelledJobCount: number;
  executionCount: number;
  pipelineRunCount: number;
  runningPipelineRunCount: number;
  completedPipelineRunCount: number;
  failedPipelineRunCount: number;
  editorialReviewCount: number;
  editorialGovernanceReadyCount: number;
  editorialRevisionRequiredCount: number;
  validationPassRate: number;
  editorialApprovalRate: number;
  revisionRate: number;
  governanceReadinessRate: number;
  confidenceDistribution: Record<FactoryConfidenceLevel, number>;
};

export type FactoryEditorialReview = {
  reviewId: string;
  factoryPackageDraftId: string;
  lifecycle: FactoryEditorialReviewLifecycle;
  validationSummary: Record<string, unknown>;
  evidenceReviewed: unknown[];
  sourcesReviewed: unknown[];
  reviewer: string;
  reason: string;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FactoryConfidenceAssessment = {
  confidenceAssessmentId: string;
  editorialReviewId: string;
  confidenceLevel: FactoryConfidenceLevel;
  confidenceScore: number;
  factors: Record<string, unknown>;
  createdBy: string;
  createdAt?: string;
};

export type FactoryEditorialDecision = {
  editorialDecisionId: string;
  editorialReviewId: string;
  decision: FactoryEditorialDecisionType;
  reason: string;
  evidenceReviewed: unknown[];
  sourcesReviewed: unknown[];
  confidenceAssessment: Record<string, unknown>;
  authorityMapping: Record<string, unknown>;
  decidedBy: string;
  createdAt?: string;
};

export type FactoryAuthorityPreparation = {
  authorityPreparationId: string;
  editorialReviewId: string;
  factoryPackageDraftId: string;
  canonicalIdentityMapping: Record<string, unknown>;
  authorityReferences: Record<string, unknown>;
  sourceTraceability: Record<string, unknown>;
  evidenceTraceability: Record<string, unknown>;
  revisionTraceability: Record<string, unknown>;
  preparedBy: string;
  createdAt?: string;
};

export type FactoryPipelineDefinition = {
  pipelineId: string;
  pipelineName: string;
  description: string;
  steps: string[];
  generationTargets: FactoryObjectType[];
};

export type FactoryPipelineRun = {
  pipelineRunId: string;
  pipelineId: string;
  status: FactoryPipelineRunStatus;
  input: Record<string, unknown>;
  artifactRefs: string[];
  factoryObjectRefs: string[];
  packageDraftId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FactoryPipelineStep = {
  pipelineStepId: string;
  pipelineRunId: string;
  stepIndex: number;
  workerKey: string;
  status: FactoryPipelineStepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  artifactRefs: string[];
  factoryObjectRefs: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type FactoryGovernanceHandoff = {
  handoffId: string;
  pipelineRunId: string | null;
  factoryPackageDraftId: string;
  factoryPackageVersionId: string | null;
  governancePublicationPackageId: string | null;
  status: FactoryGovernanceHandoffStatus;
  lineage: Record<string, unknown>;
  validationArtifactRefs: string[];
  submissionReason: string;
  createdBy: string;
  submittedBy: string | null;
  submittedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type FactorySubmissionAuditRecord = {
  auditRecordId: string;
  handoffId: string;
  action: string;
  actor: string;
  reason: string;
  packageLineage: Record<string, unknown>;
  pipelineLineage: Record<string, unknown>;
  validationArtifacts: string[];
  governancePublicationPackageId: string | null;
  createdAt?: string;
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
