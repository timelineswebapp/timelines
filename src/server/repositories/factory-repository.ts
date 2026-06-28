import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";
import type {
  FactoryArtifact,
  FactoryAuthorityPreparation,
  FactoryConfidenceAssessment,
  FactoryConfidenceLevel,
  FactoryEditorialDecision,
  FactoryEditorialDecisionType,
  FactoryEditorialReview,
  FactoryEditorialReviewLifecycle,
  FactoryArtifactType,
  FactoryFeedbackConsumption,
  FactoryFeedbackLifecycle,
  FactoryGovernanceHandoff,
  FactoryGovernanceHandoffStatus,
  FactoryObject,
  FactoryObjectLifecycle,
  FactoryObjectType,
  FactoryPackageDraft,
  FactoryPackageDraftLifecycle,
  FactoryPackageRiskSummary,
  FactoryPackageType,
  FactoryPackageVersion,
  FactoryPipelineRun,
  FactoryPipelineRunStatus,
  FactoryPipelineStep,
  FactoryPipelineStepStatus,
  FactoryRuntimeAuditRecord,
  FactoryRuntimeExecution,
  FactoryRuntimeExecutionStatus,
  FactoryRuntimeJob,
  FactoryRuntimeJobStatus,
  FactoryRuntimeMetrics,
  FactoryRuntimePrompt,
  FactoryRuntimeWorker,
  FactoryWorkerContract,
  FactoryWorkerOperation,
  FactoryWorkerRegistryRecord,
  FactoryRevisionPlan,
  FactoryRevisionPlanLifecycle
} from "@/src/server/factory/contracts";
import type { EvidenceRef, GovernanceActorRef } from "@/src/server/governance/contracts";

export type CreateFactoryObjectInput = {
  objectType: FactoryObjectType;
  title: string;
  payload: Record<string, unknown>;
  provenance: Record<string, unknown>;
  actor: string;
};

export type CreateFactoryArtifactInput = {
  factoryObjectId?: string | null;
  artifactType: FactoryArtifactType;
  title: string;
  payload: Record<string, unknown>;
  authoritySafe: boolean;
  modelProvider?: string | null;
  modelName?: string | null;
  actor: string;
};

export type CreateFactoryPackageDraftInput = {
  title: string;
  description: string;
  packageType: FactoryPackageType;
  factoryObjectRefs: string[];
  artifactRefs: string[];
  validatedEvidenceRefs?: EvidenceRef[];
  riskSummary: FactoryPackageRiskSummary;
  supersedesPackageId?: string | null;
  actor: string;
};

export type CreateFactoryPackageVersionInput = {
  draft: FactoryPackageDraft;
  packageSnapshot: Record<string, unknown>;
  supersedesVersionId?: string | null;
  feedbackPackageRefs?: string[];
  revisionPlanId?: string | null;
  sourceFeedbackPackageId?: string | null;
  resubmissionAuditRecordId?: string | null;
  actor: string;
};

export type FactoryGovernanceSubmission = {
  submissionId: string;
  factoryPackageVersionId: string;
  factoryPackageDraftId: string;
  factoryLineageRootId: string;
  governancePublicationPackageId: string;
  submissionActor: GovernanceActorRef;
  submissionReason: string;
  submissionAuditRecordId: string;
  createdAt?: string;
};

export type CreateFactoryFeedbackConsumptionInput = {
  feedbackPackageId: string;
  governancePublicationPackageId?: string | null;
  factoryPackageVersionId?: string | null;
  factoryPackageDraftId?: string | null;
  factoryLineageRootId?: string | null;
  affectedFactoryObjectIds: string[];
  classification: FactoryFeedbackConsumption["classification"];
  requiredResponse: FactoryFeedbackConsumption["requiredResponse"];
  auditRecordId: string;
  actor: string;
};

export type CreateFactoryRevisionPlanInput = {
  feedbackConsumption: FactoryFeedbackConsumption;
  planSummary: string;
  plannedActions: string[];
  auditRecordId: string;
  actor: string;
};

export type RegisterFactoryRuntimeWorkerInput = {
  workerKey: string;
  displayName: string;
  description: string;
  capabilities: string[];
  defaultProviderKey: string;
  actor: string;
};

export type RegisterFactoryRuntimePromptInput = {
  promptKey: string;
  title: string;
  template: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  actor: string;
};

export type QueueFactoryRuntimeJobInput = {
  workerId: string;
  promptId: string;
  providerKey: string;
  modelName: string;
  priority: number;
  input: Record<string, unknown>;
  configuration: Record<string, unknown>;
  actor: string;
};

export type CreateFactoryRuntimeAuditRecordInput = {
  targetRef: FactoryRuntimeAuditRecord["targetRef"];
  action: string;
  actor: string;
  reason: string;
  beforeState?: Record<string, unknown> | null;
  afterState: Record<string, unknown>;
};

export type UpsertFactoryWorkerRegistryInput = {
  contract: FactoryWorkerContract;
  permissions: FactoryWorkerOperation[];
  actor: string;
};

export type CreateFactoryPipelineRunInput = {
  pipelineId: string;
  input: Record<string, unknown>;
  actor: string;
};

export type CreateFactoryGovernanceHandoffInput = {
  pipelineRunId?: string | null;
  factoryPackageDraftId: string;
  lineage: Record<string, unknown>;
  validationArtifactRefs: string[];
  submissionReason: string;
  actor: string;
};

export type CreateFactoryEditorialReviewInput = {
  factoryPackageDraftId: string;
  lifecycle: FactoryEditorialReviewLifecycle;
  validationSummary: Record<string, unknown>;
  evidenceReviewed: unknown[];
  sourcesReviewed: unknown[];
  reviewer: string;
  reason: string;
  actor: string;
};

export type CreateFactoryEditorialDecisionInput = {
  editorialReviewId: string;
  decision: FactoryEditorialDecisionType;
  reason: string;
  evidenceReviewed: unknown[];
  sourcesReviewed: unknown[];
  confidenceAssessment: Record<string, unknown>;
  authorityMapping: Record<string, unknown>;
  decidedBy: string;
};

export type CreateFactoryConfidenceAssessmentInput = {
  editorialReviewId: string;
  confidenceLevel: FactoryConfidenceLevel;
  confidenceScore: number;
  factors: Record<string, unknown>;
  actor: string;
};

export type CreateFactoryAuthorityPreparationInput = {
  editorialReviewId: string;
  factoryPackageDraftId: string;
  canonicalIdentityMapping: Record<string, unknown>;
  authorityReferences: Record<string, unknown>;
  sourceTraceability: Record<string, unknown>;
  evidenceTraceability: Record<string, unknown>;
  revisionTraceability: Record<string, unknown>;
  preparedBy: string;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashSnapshot(snapshot: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(snapshot)).digest("hex");
}

export const factoryRepository = {
  async getGovernanceHandoffByDraft(factoryPackageDraftId: string): Promise<FactoryGovernanceHandoff | null> {
    const sql = getWriteSql("reading Factory Governance handoff by package");
    const [row] = await sql<FactoryGovernanceHandoff[]>`
      SELECT id::text AS "handoffId", pipeline_run_id::text AS "pipelineRunId",
        factory_package_draft_id::text AS "factoryPackageDraftId", factory_package_version_id::text AS "factoryPackageVersionId",
        governance_publication_package_id::text AS "governancePublicationPackageId", lineage,
        validation_artifact_refs AS "validationArtifactRefs", submission_reason AS "submissionReason",
        status, created_by AS "createdBy", updated_by AS "updatedBy", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
      FROM factory_governance_handoffs WHERE factory_package_draft_id=${factoryPackageDraftId}
      ORDER BY created_at DESC LIMIT 1`;
    return row || null;
  },
  async createGovernanceHandoff(input: CreateFactoryGovernanceHandoffInput): Promise<FactoryGovernanceHandoff> {
    const sql = getWriteSql("creating factory governance handoff");
    const [row] = await sql<FactoryGovernanceHandoff[]>`
      INSERT INTO factory_governance_handoffs (
        pipeline_run_id,
        factory_package_draft_id,
        lineage,
        validation_artifact_refs,
        submission_reason,
        created_by
      )
      VALUES (
        ${input.pipelineRunId || null},
        ${input.factoryPackageDraftId},
        ${sql.json(input.lineage as any)},
        ${sql.json(input.validationArtifactRefs as any)},
        ${input.submissionReason},
        ${input.actor}
      )
      RETURNING
        id::text AS "handoffId",
        pipeline_run_id::text AS "pipelineRunId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        status,
        lineage,
        validation_artifact_refs AS "validationArtifactRefs",
        submission_reason AS "submissionReason",
        created_by AS "createdBy",
        submitted_by AS "submittedBy",
        submitted_at::text AS "submittedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async getGovernanceHandoff(handoffId: string): Promise<FactoryGovernanceHandoff | null> {
    const sql = getWriteSql("loading factory governance handoff");
    const [row] = await sql<FactoryGovernanceHandoff[]>`
      SELECT
        id::text AS "handoffId",
        pipeline_run_id::text AS "pipelineRunId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        status,
        lineage,
        validation_artifact_refs AS "validationArtifactRefs",
        submission_reason AS "submissionReason",
        created_by AS "createdBy",
        submitted_by AS "submittedBy",
        submitted_at::text AS "submittedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_governance_handoffs
      WHERE id = ${handoffId}
      LIMIT 1
    `;
    return row || null;
  },

  async listGovernanceHandoffs(status?: FactoryGovernanceHandoffStatus, limit = 100): Promise<FactoryGovernanceHandoff[]> {
    const sql = getWriteSql("listing factory governance handoffs");
    return sql<FactoryGovernanceHandoff[]>`
      SELECT
        id::text AS "handoffId",
        pipeline_run_id::text AS "pipelineRunId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        status,
        lineage,
        validation_artifact_refs AS "validationArtifactRefs",
        submission_reason AS "submissionReason",
        created_by AS "createdBy",
        submitted_by AS "submittedBy",
        submitted_at::text AS "submittedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_governance_handoffs
      WHERE ${status || null}::text IS NULL OR status = ${status || null}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async markGovernanceHandoffSubmitted(input: {
    handoffId: string;
    factoryPackageVersionId: string;
    governancePublicationPackageId: string;
    actor: string;
  }): Promise<FactoryGovernanceHandoff> {
    const sql = getWriteSql("marking factory governance handoff submitted");
    const [row] = await sql<FactoryGovernanceHandoff[]>`
      UPDATE factory_governance_handoffs
      SET status = 'submitted_to_governance',
          factory_package_version_id = ${input.factoryPackageVersionId},
          governance_publication_package_id = ${input.governancePublicationPackageId},
          submitted_by = ${input.actor},
          submitted_at = NOW()
      WHERE id = ${input.handoffId}
        AND status = 'prepared'
      RETURNING
        id::text AS "handoffId",
        pipeline_run_id::text AS "pipelineRunId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        status,
        lineage,
        validation_artifact_refs AS "validationArtifactRefs",
        submission_reason AS "submissionReason",
        created_by AS "createdBy",
        submitted_by AS "submittedBy",
        submitted_at::text AS "submittedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(409, "FACTORY_HANDOFF_NOT_PREPARED", "Only prepared Factory handoffs can be submitted.");
    }
    return row;
  },

  async createSubmissionAuditRecord(input: {
    handoffId: string;
    action: string;
    actor: string;
    reason: string;
    packageLineage: Record<string, unknown>;
    pipelineLineage: Record<string, unknown>;
    validationArtifacts: string[];
    governancePublicationPackageId?: string | null;
  }): Promise<string> {
    const sql = getWriteSql("creating factory submission audit record");
    const [row] = await sql<Array<{ auditRecordId: string }>>`
      INSERT INTO factory_submission_audit_records (
        handoff_id,
        action,
        actor,
        reason,
        package_lineage,
        pipeline_lineage,
        validation_artifacts,
        governance_publication_package_id
      )
      VALUES (
        ${input.handoffId},
        ${input.action},
        ${input.actor},
        ${input.reason},
        ${sql.json(input.packageLineage as any)},
        ${sql.json(input.pipelineLineage as any)},
        ${sql.json(input.validationArtifacts as any)},
        ${input.governancePublicationPackageId || null}
      )
      RETURNING id::text AS "auditRecordId"
    `;
    return row!.auditRecordId;
  },

  async createSubmissionLineage(input: {
    handoffId: string;
    pipelineRunId?: string | null;
    factoryPackageDraftId: string;
    factoryPackageVersionId?: string | null;
    governancePublicationPackageId?: string | null;
    workerOutputs: string[];
    validationArtifacts: string[];
    governanceDecisions?: string[];
  }): Promise<void> {
    const sql = getWriteSql("creating factory submission lineage");
    await sql`
      INSERT INTO factory_submission_lineage (
        handoff_id,
        pipeline_run_id,
        factory_package_draft_id,
        factory_package_version_id,
        governance_publication_package_id,
        worker_outputs,
        validation_artifacts,
        governance_decisions
      )
      VALUES (
        ${input.handoffId},
        ${input.pipelineRunId || null},
        ${input.factoryPackageDraftId},
        ${input.factoryPackageVersionId || null},
        ${input.governancePublicationPackageId || null},
        ${sql.json(input.workerOutputs as any)},
        ${sql.json(input.validationArtifacts as any)},
        ${sql.json((input.governanceDecisions || []) as any)}
      )
    `;
  },

  async createPipelineRun(input: CreateFactoryPipelineRunInput): Promise<FactoryPipelineRun> {
    const sql = getWriteSql("creating factory pipeline run");
    const [row] = await sql<FactoryPipelineRun[]>`
      INSERT INTO factory_pipeline_runs (pipeline_id, input, created_by, updated_by)
      VALUES (${input.pipelineId}, ${sql.json(input.input as any)}, ${input.actor}, ${input.actor})
      RETURNING
        id::text AS "pipelineRunId",
        pipeline_id AS "pipelineId",
        status,
        input,
        artifact_refs AS "artifactRefs",
        factory_object_refs AS "factoryObjectRefs",
        package_draft_id::text AS "packageDraftId",
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async getPipelineRun(pipelineRunId: string): Promise<FactoryPipelineRun | null> {
    const sql = getWriteSql("loading factory pipeline run");
    const [row] = await sql<FactoryPipelineRun[]>`
      SELECT
        id::text AS "pipelineRunId",
        pipeline_id AS "pipelineId",
        status,
        input,
        artifact_refs AS "artifactRefs",
        factory_object_refs AS "factoryObjectRefs",
        package_draft_id::text AS "packageDraftId",
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_pipeline_runs
      WHERE id = ${pipelineRunId}
      LIMIT 1
    `;
    return row || null;
  },

  async getLatestCompletedPipelineRun(pipelineId: string, subject: string): Promise<FactoryPipelineRun | null> {
    const sql = getWriteSql("loading latest completed Factory pipeline run");
    const [row] = await sql<FactoryPipelineRun[]>`
      SELECT
        id::text AS "pipelineRunId",
        pipeline_id AS "pipelineId",
        status,
        input,
        artifact_refs AS "artifactRefs",
        factory_object_refs AS "factoryObjectRefs",
        package_draft_id::text AS "packageDraftId",
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_pipeline_runs
      WHERE pipeline_id = ${pipelineId}
        AND status = 'completed'
        AND lower(input->>'subject') = lower(${subject})
      ORDER BY completed_at DESC, created_at DESC
      LIMIT 1
    `;
    return row || null;
  },

  async listPipelineRuns(status?: FactoryPipelineRunStatus, limit = 100): Promise<FactoryPipelineRun[]> {
    const sql = getWriteSql("listing factory pipeline runs");
    return sql<FactoryPipelineRun[]>`
      SELECT
        id::text AS "pipelineRunId",
        pipeline_id AS "pipelineId",
        status,
        input,
        artifact_refs AS "artifactRefs",
        factory_object_refs AS "factoryObjectRefs",
        package_draft_id::text AS "packageDraftId",
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_pipeline_runs
      WHERE ${status || null}::text IS NULL OR status = ${status || null}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async transitionPipelineRun(input: {
    pipelineRunId: string;
    status: FactoryPipelineRunStatus;
    actor: string;
    artifactRefs?: string[];
    factoryObjectRefs?: string[];
    packageDraftId?: string | null;
  }): Promise<FactoryPipelineRun> {
    const sql = getWriteSql("transitioning factory pipeline run");
    const [row] = await sql<FactoryPipelineRun[]>`
      UPDATE factory_pipeline_runs
      SET status = ${input.status},
          artifact_refs = COALESCE(${input.artifactRefs ? sql.json(input.artifactRefs as any) : null}, artifact_refs),
          factory_object_refs = COALESCE(${input.factoryObjectRefs ? sql.json(input.factoryObjectRefs as any) : null}, factory_object_refs),
          package_draft_id = COALESCE(${input.packageDraftId || null}, package_draft_id),
          started_at = CASE WHEN ${input.status} = 'running' THEN NOW() ELSE started_at END,
          completed_at = CASE WHEN ${input.status} IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
          updated_by = ${input.actor}
      WHERE id = ${input.pipelineRunId}
      RETURNING
        id::text AS "pipelineRunId",
        pipeline_id AS "pipelineId",
        status,
        input,
        artifact_refs AS "artifactRefs",
        factory_object_refs AS "factoryObjectRefs",
        package_draft_id::text AS "packageDraftId",
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(404, "FACTORY_PIPELINE_RUN_NOT_FOUND", "Factory pipeline run not found.");
    }
    return row;
  },

  async createPipelineStep(input: {
    pipelineRunId: string;
    stepIndex: number;
    workerKey: string;
    input: Record<string, unknown>;
  }): Promise<FactoryPipelineStep> {
    const sql = getWriteSql("creating factory pipeline step");
    const [row] = await sql<FactoryPipelineStep[]>`
      INSERT INTO factory_pipeline_steps (pipeline_run_id, step_index, worker_key, input)
      VALUES (${input.pipelineRunId}, ${input.stepIndex}, ${input.workerKey}, ${sql.json(input.input as any)})
      RETURNING
        id::text AS "pipelineStepId",
        pipeline_run_id::text AS "pipelineRunId",
        step_index::int AS "stepIndex",
        worker_key AS "workerKey",
        status,
        input,
        output,
        artifact_refs AS "artifactRefs",
        factory_object_refs AS "factoryObjectRefs",
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async transitionPipelineStep(input: {
    pipelineStepId: string;
    status: FactoryPipelineStepStatus;
    output?: Record<string, unknown> | null;
    artifactRefs?: string[];
    factoryObjectRefs?: string[];
  }): Promise<FactoryPipelineStep> {
    const sql = getWriteSql("transitioning factory pipeline step");
    const [row] = await sql<FactoryPipelineStep[]>`
      UPDATE factory_pipeline_steps
      SET status = ${input.status},
          output = COALESCE(${input.output ? sql.json(input.output as any) : null}, output),
          artifact_refs = COALESCE(${input.artifactRefs ? sql.json(input.artifactRefs as any) : null}, artifact_refs),
          factory_object_refs = COALESCE(${input.factoryObjectRefs ? sql.json(input.factoryObjectRefs as any) : null}, factory_object_refs),
          started_at = CASE WHEN ${input.status} = 'running' THEN NOW() ELSE started_at END,
          completed_at = CASE WHEN ${input.status} IN ('completed', 'failed', 'skipped', 'cancelled') THEN NOW() ELSE completed_at END
      WHERE id = ${input.pipelineStepId}
      RETURNING
        id::text AS "pipelineStepId",
        pipeline_run_id::text AS "pipelineRunId",
        step_index::int AS "stepIndex",
        worker_key AS "workerKey",
        status,
        input,
        output,
        artifact_refs AS "artifactRefs",
        factory_object_refs AS "factoryObjectRefs",
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(404, "FACTORY_PIPELINE_STEP_NOT_FOUND", "Factory pipeline step not found.");
    }
    return row;
  },

  async createEditorialReview(input: CreateFactoryEditorialReviewInput): Promise<FactoryEditorialReview> {
    const sql = getWriteSql("creating factory editorial review");
    const [row] = await sql<FactoryEditorialReview[]>`
      INSERT INTO factory_editorial_reviews (
        factory_package_draft_id,
        lifecycle,
        validation_summary,
        evidence_reviewed,
        sources_reviewed,
        reviewer,
        reason,
        created_by,
        updated_by
      )
      VALUES (
        ${input.factoryPackageDraftId},
        ${input.lifecycle},
        ${sql.json(input.validationSummary as any)},
        ${sql.json(input.evidenceReviewed as any)},
        ${sql.json(input.sourcesReviewed as any)},
        ${input.reviewer},
        ${input.reason},
        ${input.actor},
        ${input.actor}
      )
      RETURNING
        id::text AS "reviewId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        lifecycle,
        validation_summary AS "validationSummary",
        evidence_reviewed AS "evidenceReviewed",
        sources_reviewed AS "sourcesReviewed",
        reviewer,
        reason,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async getEditorialReview(reviewId: string): Promise<FactoryEditorialReview | null> {
    const sql = getWriteSql("loading factory editorial review");
    const [row] = await sql<FactoryEditorialReview[]>`
      SELECT
        id::text AS "reviewId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        lifecycle,
        validation_summary AS "validationSummary",
        evidence_reviewed AS "evidenceReviewed",
        sources_reviewed AS "sourcesReviewed",
        reviewer,
        reason,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_editorial_reviews
      WHERE id = ${reviewId}
      LIMIT 1
    `;
    return row || null;
  },

  async getLatestEditorialReviewForPackage(factoryPackageDraftId: string): Promise<FactoryEditorialReview | null> {
    const sql = getWriteSql("loading latest factory editorial review");
    const [row] = await sql<FactoryEditorialReview[]>`
      SELECT
        id::text AS "reviewId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        lifecycle,
        validation_summary AS "validationSummary",
        evidence_reviewed AS "evidenceReviewed",
        sources_reviewed AS "sourcesReviewed",
        reviewer,
        reason,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_editorial_reviews
      WHERE factory_package_draft_id = ${factoryPackageDraftId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return row || null;
  },

  async listEditorialReviews(limit = 100): Promise<FactoryEditorialReview[]> {
    const sql = getWriteSql("listing factory editorial reviews");
    return sql<FactoryEditorialReview[]>`
      SELECT
        id::text AS "reviewId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        lifecycle,
        validation_summary AS "validationSummary",
        evidence_reviewed AS "evidenceReviewed",
        sources_reviewed AS "sourcesReviewed",
        reviewer,
        reason,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_editorial_reviews
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async transitionEditorialReview(reviewId: string, lifecycle: FactoryEditorialReviewLifecycle, actor: string): Promise<FactoryEditorialReview> {
    const sql = getWriteSql("transitioning factory editorial review");
    const [row] = await sql<FactoryEditorialReview[]>`
      UPDATE factory_editorial_reviews
      SET lifecycle = ${lifecycle}, updated_by = ${actor}
      WHERE id = ${reviewId}
      RETURNING
        id::text AS "reviewId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        lifecycle,
        validation_summary AS "validationSummary",
        evidence_reviewed AS "evidenceReviewed",
        sources_reviewed AS "sourcesReviewed",
        reviewer,
        reason,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(404, "FACTORY_EDITORIAL_REVIEW_NOT_FOUND", "Factory editorial review not found.");
    }
    return row;
  },

  async createConfidenceAssessment(input: CreateFactoryConfidenceAssessmentInput): Promise<FactoryConfidenceAssessment> {
    const sql = getWriteSql("creating factory confidence assessment");
    const [row] = await sql<FactoryConfidenceAssessment[]>`
      INSERT INTO factory_confidence_assessments (editorial_review_id, confidence_level, confidence_score, factors, created_by)
      VALUES (${input.editorialReviewId}, ${input.confidenceLevel}, ${input.confidenceScore}, ${sql.json(input.factors as any)}, ${input.actor})
      RETURNING
        id::text AS "confidenceAssessmentId",
        editorial_review_id::text AS "editorialReviewId",
        confidence_level AS "confidenceLevel",
        confidence_score::float AS "confidenceScore",
        factors,
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async createEditorialDecision(input: CreateFactoryEditorialDecisionInput): Promise<FactoryEditorialDecision> {
    const sql = getWriteSql("creating factory editorial decision");
    const [row] = await sql<FactoryEditorialDecision[]>`
      INSERT INTO factory_editorial_decisions (
        editorial_review_id,
        decision,
        reason,
        evidence_reviewed,
        sources_reviewed,
        confidence_assessment,
        authority_mapping,
        decided_by
      )
      VALUES (
        ${input.editorialReviewId},
        ${input.decision},
        ${input.reason},
        ${sql.json(input.evidenceReviewed as any)},
        ${sql.json(input.sourcesReviewed as any)},
        ${sql.json(input.confidenceAssessment as any)},
        ${sql.json(input.authorityMapping as any)},
        ${input.decidedBy}
      )
      RETURNING
        id::text AS "editorialDecisionId",
        editorial_review_id::text AS "editorialReviewId",
        decision,
        reason,
        evidence_reviewed AS "evidenceReviewed",
        sources_reviewed AS "sourcesReviewed",
        confidence_assessment AS "confidenceAssessment",
        authority_mapping AS "authorityMapping",
        decided_by AS "decidedBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async createAuthorityPreparation(input: CreateFactoryAuthorityPreparationInput): Promise<FactoryAuthorityPreparation> {
    const sql = getWriteSql("creating factory authority preparation");
    const [row] = await sql<FactoryAuthorityPreparation[]>`
      INSERT INTO factory_authority_preparations (
        editorial_review_id,
        factory_package_draft_id,
        canonical_identity_mapping,
        authority_references,
        source_traceability,
        evidence_traceability,
        revision_traceability,
        prepared_by
      )
      VALUES (
        ${input.editorialReviewId},
        ${input.factoryPackageDraftId},
        ${sql.json(input.canonicalIdentityMapping as any)},
        ${sql.json(input.authorityReferences as any)},
        ${sql.json(input.sourceTraceability as any)},
        ${sql.json(input.evidenceTraceability as any)},
        ${sql.json(input.revisionTraceability as any)},
        ${input.preparedBy}
      )
      RETURNING
        id::text AS "authorityPreparationId",
        editorial_review_id::text AS "editorialReviewId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        canonical_identity_mapping AS "canonicalIdentityMapping",
        authority_references AS "authorityReferences",
        source_traceability AS "sourceTraceability",
        evidence_traceability AS "evidenceTraceability",
        revision_traceability AS "revisionTraceability",
        prepared_by AS "preparedBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async getLatestAuthorityPreparationForReview(editorialReviewId: string): Promise<FactoryAuthorityPreparation | null> {
    const sql = getWriteSql("loading latest factory authority preparation");
    const [row] = await sql<FactoryAuthorityPreparation[]>`
      SELECT
        id::text AS "authorityPreparationId",
        editorial_review_id::text AS "editorialReviewId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        canonical_identity_mapping AS "canonicalIdentityMapping",
        authority_references AS "authorityReferences",
        source_traceability AS "sourceTraceability",
        evidence_traceability AS "evidenceTraceability",
        revision_traceability AS "revisionTraceability",
        prepared_by AS "preparedBy",
        created_at::text AS "createdAt"
      FROM factory_authority_preparations
      WHERE editorial_review_id = ${editorialReviewId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return row || null;
  },

  async upsertWorkerRegistryContract(input: UpsertFactoryWorkerRegistryInput): Promise<FactoryWorkerRegistryRecord> {
    const sql = getWriteSql("upserting factory worker registry contract");
    const contract = input.contract;
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await tx`
        INSERT INTO factory_worker_capabilities (
          worker_key,
          worker_name,
          worker_category,
          allowed_inputs,
          allowed_outputs,
          allowed_object_types,
          allowed_relationship_types,
          status,
          created_by,
          updated_by
        )
        VALUES (
          ${contract.worker_id},
          ${contract.worker_name},
          ${contract.worker_category},
          ${tx.json(contract.allowed_inputs as any)},
          ${tx.json(contract.allowed_outputs as any)},
          ${tx.json(contract.allowed_object_types as any)},
          ${tx.json(contract.allowed_relationship_types as any)},
          'active',
          ${input.actor},
          ${input.actor}
        )
        ON CONFLICT (worker_key) DO UPDATE
        SET worker_name = EXCLUDED.worker_name,
            worker_category = EXCLUDED.worker_category,
            allowed_inputs = EXCLUDED.allowed_inputs,
            allowed_outputs = EXCLUDED.allowed_outputs,
            allowed_object_types = EXCLUDED.allowed_object_types,
            allowed_relationship_types = EXCLUDED.allowed_relationship_types,
            status = 'active',
            updated_by = EXCLUDED.updated_by
      `;

      await tx`
        UPDATE factory_worker_policies
        SET status = 'superseded'
        WHERE worker_key = ${contract.worker_id}
          AND status = 'active'
      `;

      const [policy] = await tx<Array<{ policyId: string }>>`
        INSERT INTO factory_worker_policies (
          worker_key,
          provider_policy,
          max_context_tokens,
          max_output_tokens,
          retry_policy,
          execution_timeout,
          audit_requirements,
          forbidden_operations,
          status,
          created_by
        )
        VALUES (
          ${contract.worker_id},
          ${tx.json(contract.provider_policy as any)},
          ${contract.max_context_tokens},
          ${contract.max_output_tokens},
          ${tx.json(contract.retry_policy as any)},
          ${contract.execution_timeout},
          ${tx.json(contract.audit_requirements as any)},
          ${tx.json(contract.forbidden_operations as any)},
          'active',
          ${input.actor}
        )
        RETURNING id::text AS "policyId"
      `;

      await tx`
        UPDATE factory_worker_versions
        SET status = 'superseded'
        WHERE worker_key = ${contract.worker_id}
          AND worker_version <> ${contract.worker_version}
          AND status = 'active'
      `;

      const [version] = await tx<Array<{ workerRegistryId: string }>>`
        INSERT INTO factory_worker_versions (
          worker_key,
          worker_version,
          contract,
          policy_id,
          status,
          created_by
        )
        VALUES (
          ${contract.worker_id},
          ${contract.worker_version},
          ${tx.json(contract as any)},
          ${policy!.policyId},
          'active',
          ${input.actor}
        )
        ON CONFLICT (worker_key, worker_version) DO UPDATE
        SET contract = EXCLUDED.contract,
            policy_id = EXCLUDED.policy_id,
            status = 'active'
        RETURNING id::text AS "workerRegistryId"
      `;

      await tx`
        INSERT INTO factory_worker_permissions (
          worker_key,
          worker_version_id,
          allowed_operations,
          forbidden_operations,
          provider_policy,
          created_by
        )
        VALUES (
          ${contract.worker_id},
          ${version!.workerRegistryId},
          ${tx.json(input.permissions as any)},
          ${tx.json(contract.forbidden_operations as any)},
          ${tx.json(contract.provider_policy as any)},
          ${input.actor}
        )
        ON CONFLICT (worker_version_id) DO UPDATE
        SET allowed_operations = EXCLUDED.allowed_operations,
            forbidden_operations = EXCLUDED.forbidden_operations,
            provider_policy = EXCLUDED.provider_policy
      `;

      return {
        workerRegistryId: version!.workerRegistryId,
        workerKey: contract.worker_id,
        workerName: contract.worker_name,
        workerVersion: contract.worker_version,
        workerCategory: contract.worker_category,
        contract,
        policy: {
          providerPolicy: contract.provider_policy,
          maxContextTokens: contract.max_context_tokens,
          maxOutputTokens: contract.max_output_tokens,
          retryPolicy: contract.retry_policy,
          executionTimeout: contract.execution_timeout,
          auditRequirements: contract.audit_requirements
        },
        permissions: input.permissions,
        forbiddenOperations: contract.forbidden_operations,
        providerPolicy: contract.provider_policy,
        status: "active",
        createdBy: input.actor
      };
    });
  },

  async listWorkerRegistry(limit = 100): Promise<FactoryWorkerRegistryRecord[]> {
    const sql = getWriteSql("listing factory worker registry");
    const rows = await sql<Array<{
      workerRegistryId: string;
      workerKey: string;
      workerName: string;
      workerVersion: number;
      workerCategory: FactoryWorkerRegistryRecord["workerCategory"];
      contract: FactoryWorkerContract;
      permissions: FactoryWorkerOperation[];
      forbiddenOperations: FactoryWorkerRegistryRecord["forbiddenOperations"];
      providerPolicy: FactoryWorkerRegistryRecord["providerPolicy"];
      status: FactoryWorkerRegistryRecord["status"];
      createdBy: string;
      createdAt?: string;
    }>>`
      SELECT
        factory_worker_versions.id::text AS "workerRegistryId",
        factory_worker_versions.worker_key AS "workerKey",
        factory_worker_capabilities.worker_name AS "workerName",
        factory_worker_versions.worker_version::int AS "workerVersion",
        factory_worker_capabilities.worker_category AS "workerCategory",
        factory_worker_versions.contract AS "contract",
        factory_worker_permissions.allowed_operations AS "permissions",
        factory_worker_permissions.forbidden_operations AS "forbiddenOperations",
        factory_worker_permissions.provider_policy AS "providerPolicy",
        factory_worker_versions.status AS "status",
        factory_worker_versions.created_by AS "createdBy",
        factory_worker_versions.created_at::text AS "createdAt"
      FROM factory_worker_versions
      INNER JOIN factory_worker_capabilities
        ON factory_worker_capabilities.worker_key = factory_worker_versions.worker_key
      INNER JOIN factory_worker_permissions
        ON factory_worker_permissions.worker_version_id = factory_worker_versions.id
      ORDER BY factory_worker_versions.created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      ...row,
      policy: {
        providerPolicy: row.providerPolicy,
        maxContextTokens: row.contract.max_context_tokens,
        maxOutputTokens: row.contract.max_output_tokens,
        retryPolicy: row.contract.retry_policy,
        executionTimeout: row.contract.execution_timeout,
        auditRequirements: row.contract.audit_requirements
      }
    }));
  },

  async registerRuntimeWorker(input: RegisterFactoryRuntimeWorkerInput): Promise<FactoryRuntimeWorker> {
    const sql = getWriteSql("registering factory runtime worker");
    const [row] = await sql<FactoryRuntimeWorker[]>`
      INSERT INTO factory_runtime_workers (worker_key, display_name, description, capabilities, default_provider_key, created_by, updated_by)
      VALUES (${input.workerKey}, ${input.displayName}, ${input.description}, ${sql.json(input.capabilities as any)}, ${input.defaultProviderKey}, ${input.actor}, ${input.actor})
      ON CONFLICT (worker_key) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          capabilities = EXCLUDED.capabilities,
          default_provider_key = EXCLUDED.default_provider_key,
          status = 'registered',
          updated_by = EXCLUDED.updated_by
      RETURNING
        id::text AS "workerId",
        worker_key AS "workerKey",
        display_name AS "displayName",
        description,
        capabilities,
        default_provider_key AS "defaultProviderKey",
        status,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async getRuntimeWorker(workerId: string): Promise<FactoryRuntimeWorker | null> {
    const sql = getWriteSql("loading factory runtime worker");
    const [row] = await sql<FactoryRuntimeWorker[]>`
      SELECT
        id::text AS "workerId",
        worker_key AS "workerKey",
        display_name AS "displayName",
        description,
        capabilities,
        default_provider_key AS "defaultProviderKey",
        status,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_runtime_workers
      WHERE id = ${workerId}
      LIMIT 1
    `;
    return row || null;
  },

  async listRuntimeWorkers(limit = 100): Promise<FactoryRuntimeWorker[]> {
    const sql = getWriteSql("listing factory runtime workers");
    return sql<FactoryRuntimeWorker[]>`
      SELECT
        id::text AS "workerId",
        worker_key AS "workerKey",
        display_name AS "displayName",
        description,
        capabilities,
        default_provider_key AS "defaultProviderKey",
        status,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_runtime_workers
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async registerRuntimePrompt(input: RegisterFactoryRuntimePromptInput): Promise<FactoryRuntimePrompt> {
    const sql = getWriteSql("registering factory runtime prompt");
    const latest = await sql<Array<{ version: number }>>`
      SELECT COALESCE(MAX(version), 0)::int AS version
      FROM factory_runtime_prompts
      WHERE prompt_key = ${input.promptKey}
    `;
    const version = (latest[0]?.version || 0) + 1;
    const [row] = await sql<FactoryRuntimePrompt[]>`
      WITH superseded AS (
        UPDATE factory_runtime_prompts
        SET status = 'superseded'
        WHERE prompt_key = ${input.promptKey}
          AND status = 'active'
      )
      INSERT INTO factory_runtime_prompts (prompt_key, version, title, template, input_schema, output_schema, status, created_by)
      VALUES (${input.promptKey}, ${version}, ${input.title}, ${input.template}, ${sql.json(input.inputSchema as any)}, ${sql.json(input.outputSchema as any)}, 'active', ${input.actor})
      RETURNING
        id::text AS "promptId",
        prompt_key AS "promptKey",
        version::int,
        title,
        template,
        input_schema AS "inputSchema",
        output_schema AS "outputSchema",
        status,
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async getRuntimePrompt(promptId: string): Promise<FactoryRuntimePrompt | null> {
    const sql = getWriteSql("loading factory runtime prompt");
    const [row] = await sql<FactoryRuntimePrompt[]>`
      SELECT
        id::text AS "promptId",
        prompt_key AS "promptKey",
        version::int,
        title,
        template,
        input_schema AS "inputSchema",
        output_schema AS "outputSchema",
        status,
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM factory_runtime_prompts
      WHERE id = ${promptId}
      LIMIT 1
    `;
    return row || null;
  },

  async listRuntimePrompts(limit = 100): Promise<FactoryRuntimePrompt[]> {
    const sql = getWriteSql("listing factory runtime prompts");
    return sql<FactoryRuntimePrompt[]>`
      SELECT
        id::text AS "promptId",
        prompt_key AS "promptKey",
        version::int,
        title,
        template,
        input_schema AS "inputSchema",
        output_schema AS "outputSchema",
        status,
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM factory_runtime_prompts
      ORDER BY prompt_key ASC, version DESC
      LIMIT ${limit}
    `;
  },

  async queueRuntimeJob(input: QueueFactoryRuntimeJobInput): Promise<FactoryRuntimeJob> {
    const sql = getWriteSql("queueing factory runtime job");
    const [row] = await sql<FactoryRuntimeJob[]>`
      INSERT INTO factory_runtime_jobs (worker_id, prompt_id, provider_key, model_name, priority, input, configuration, queued_by, updated_by)
      VALUES (${input.workerId}, ${input.promptId}, ${input.providerKey}, ${input.modelName}, ${input.priority}, ${sql.json(input.input as any)}, ${sql.json(input.configuration as any)}, ${input.actor}, ${input.actor})
      RETURNING
        id::text AS "jobId",
        worker_id::text AS "workerId",
        prompt_id::text AS "promptId",
        provider_key AS "providerKey",
        model_name AS "modelName",
        status,
        priority::int,
        input,
        configuration,
        queued_by AS "queuedBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async getRuntimeJob(jobId: string): Promise<FactoryRuntimeJob | null> {
    const sql = getWriteSql("loading factory runtime job");
    const [row] = await sql<FactoryRuntimeJob[]>`
      SELECT
        id::text AS "jobId",
        worker_id::text AS "workerId",
        prompt_id::text AS "promptId",
        provider_key AS "providerKey",
        model_name AS "modelName",
        status,
        priority::int,
        input,
        configuration,
        queued_by AS "queuedBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_runtime_jobs
      WHERE id = ${jobId}
      LIMIT 1
    `;
    return row || null;
  },

  async listRuntimeJobs(status?: FactoryRuntimeJobStatus, limit = 100): Promise<FactoryRuntimeJob[]> {
    const sql = getWriteSql("listing factory runtime jobs");
    return sql<FactoryRuntimeJob[]>`
      SELECT
        id::text AS "jobId",
        worker_id::text AS "workerId",
        prompt_id::text AS "promptId",
        provider_key AS "providerKey",
        model_name AS "modelName",
        status,
        priority::int,
        input,
        configuration,
        queued_by AS "queuedBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_runtime_jobs
      WHERE ${status || null}::text IS NULL OR status = ${status || null}
      ORDER BY priority DESC, created_at ASC
      LIMIT ${limit}
    `;
  },

  async transitionRuntimeJob(jobId: string, status: FactoryRuntimeJobStatus, actor: string): Promise<FactoryRuntimeJob> {
    const sql = getWriteSql("transitioning factory runtime job");
    const [row] = await sql<FactoryRuntimeJob[]>`
      UPDATE factory_runtime_jobs
      SET status = ${status}, updated_by = ${actor}
      WHERE id = ${jobId}
      RETURNING
        id::text AS "jobId",
        worker_id::text AS "workerId",
        prompt_id::text AS "promptId",
        provider_key AS "providerKey",
        model_name AS "modelName",
        status,
        priority::int,
        input,
        configuration,
        queued_by AS "queuedBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(404, "FACTORY_RUNTIME_JOB_NOT_FOUND", "Factory runtime job not found.");
    }
    return row;
  },

  async createRuntimeExecution(job: FactoryRuntimeJob, actor: string): Promise<FactoryRuntimeExecution> {
    const sql = getWriteSql("creating factory runtime execution");
    const [row] = await sql<FactoryRuntimeExecution[]>`
      INSERT INTO factory_runtime_executions (job_id, worker_id, provider_key, model_name, status, input, created_by, updated_by)
      VALUES (${job.jobId}, ${job.workerId}, ${job.providerKey}, ${job.modelName}, 'created', ${sql.json(job.input as any)}, ${actor}, ${actor})
      RETURNING
        id::text AS "executionId",
        job_id::text AS "jobId",
        worker_id::text AS "workerId",
        provider_key AS "providerKey",
        model_name AS "modelName",
        status,
        input,
        output,
        error,
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async transitionRuntimeExecution(input: {
    executionId: string;
    status: FactoryRuntimeExecutionStatus;
    output?: Record<string, unknown> | null;
    error?: Record<string, unknown> | null;
    actor: string;
  }): Promise<FactoryRuntimeExecution> {
    const sql = getWriteSql("transitioning factory runtime execution");
    const [row] = await sql<FactoryRuntimeExecution[]>`
      UPDATE factory_runtime_executions
      SET status = ${input.status},
          output = COALESCE(${input.output ? sql.json(input.output as any) : null}, output),
          error = COALESCE(${input.error ? sql.json(input.error as any) : null}, error),
          started_at = CASE WHEN ${input.status} = 'started' THEN NOW() ELSE started_at END,
          completed_at = CASE WHEN ${input.status} IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
          updated_by = ${input.actor}
      WHERE id = ${input.executionId}
      RETURNING
        id::text AS "executionId",
        job_id::text AS "jobId",
        worker_id::text AS "workerId",
        provider_key AS "providerKey",
        model_name AS "modelName",
        status,
        input,
        output,
        error,
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(404, "FACTORY_RUNTIME_EXECUTION_NOT_FOUND", "Factory runtime execution not found.");
    }
    return row;
  },

  async listRuntimeExecutions(jobId?: string, limit = 100): Promise<FactoryRuntimeExecution[]> {
    const sql = getWriteSql("listing factory runtime executions");
    return sql<FactoryRuntimeExecution[]>`
      SELECT
        id::text AS "executionId",
        job_id::text AS "jobId",
        worker_id::text AS "workerId",
        provider_key AS "providerKey",
        model_name AS "modelName",
        status,
        input,
        output,
        error,
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_runtime_executions
      WHERE ${jobId || null}::uuid IS NULL OR job_id = ${jobId || null}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async createRuntimeAuditRecord(input: CreateFactoryRuntimeAuditRecordInput): Promise<string> {
    const sql = getWriteSql("creating factory runtime audit record");
    const [row] = await sql<Array<{ auditRecordId: string }>>`
      INSERT INTO factory_runtime_audit_records (target_ref, action, actor, reason, before_state, after_state)
      VALUES (${sql.json(input.targetRef as any)}, ${input.action}, ${input.actor}, ${input.reason}, ${input.beforeState ? sql.json(input.beforeState as any) : null}, ${sql.json(input.afterState as any)})
      RETURNING id::text AS "auditRecordId"
    `;
    return row!.auditRecordId;
  },

  async recordProviderExecutionMetric(input: {
    providerKey: string; modelName: string; status: "completed" | "failed" | "throttled";
    latencyMs: number; estimatedInputTokens: number; maxOutputTokens?: number | null; estimatedCostUsd: number;
  }) {
    const sql = getWriteSql("recording provider performance metric");
    await sql`INSERT INTO provider_execution_metrics
      (provider_key,model_name,status,latency_ms,estimated_input_tokens,max_output_tokens,estimated_cost_usd)
      VALUES (${input.providerKey},${input.modelName},${input.status},${input.latencyMs},
        ${input.estimatedInputTokens},${input.maxOutputTokens || null},${input.estimatedCostUsd})`;
  },

  async getRuntimeMetrics(): Promise<FactoryRuntimeMetrics> {
    const sql = getWriteSql("loading factory runtime metrics");
    const [row] = await sql<Array<FactoryRuntimeMetrics>>`
      SELECT
        (SELECT COUNT(*)::int FROM factory_runtime_workers) AS "workerCount",
        (SELECT COUNT(*)::int FROM factory_runtime_workers WHERE status = 'registered') AS "activeWorkerCount",
        (SELECT COUNT(*)::int FROM factory_worker_policies WHERE status = 'active') AS "workerPolicyCount",
        (SELECT COUNT(*)::int FROM factory_worker_versions WHERE status = 'active') AS "workerVersionCount",
        (SELECT COUNT(*)::int FROM factory_worker_permissions) AS "workerPermissionCount",
        (SELECT COUNT(*)::int FROM factory_runtime_prompts) AS "promptCount",
        (SELECT COUNT(*)::int FROM factory_runtime_jobs WHERE status = 'queued') AS "queuedJobCount",
        (SELECT COUNT(*)::int FROM factory_runtime_jobs WHERE status = 'running') AS "runningJobCount",
        (SELECT COUNT(*)::int FROM factory_runtime_jobs WHERE status = 'completed') AS "completedJobCount",
        (SELECT COUNT(*)::int FROM factory_runtime_jobs WHERE status = 'failed') AS "failedJobCount",
        (SELECT COUNT(*)::int FROM factory_runtime_jobs WHERE status = 'cancelled') AS "cancelledJobCount",
        (SELECT COUNT(*)::int FROM factory_runtime_executions) AS "executionCount",
        (SELECT COUNT(*)::int FROM factory_pipeline_runs) AS "pipelineRunCount",
        (SELECT COUNT(*)::int FROM factory_pipeline_runs WHERE status = 'running') AS "runningPipelineRunCount",
        (SELECT COUNT(*)::int FROM factory_pipeline_runs WHERE status = 'completed') AS "completedPipelineRunCount",
        (SELECT COUNT(*)::int FROM factory_pipeline_runs WHERE status = 'failed') AS "failedPipelineRunCount",
        (SELECT COUNT(*)::int FROM factory_editorial_reviews) AS "editorialReviewCount",
        (SELECT COUNT(*)::int FROM factory_editorial_reviews WHERE lifecycle = 'governance_ready') AS "editorialGovernanceReadyCount",
        (SELECT COUNT(*)::int FROM factory_editorial_reviews WHERE lifecycle = 'revision_required') AS "editorialRevisionRequiredCount",
        COALESCE((SELECT COUNT(*)::float FROM factory_editorial_reviews WHERE lifecycle IN ('validated', 'under_editorial_review', 'editorially_approved', 'authority_prepared', 'governance_ready')) / NULLIF((SELECT COUNT(*)::float FROM factory_editorial_reviews), 0), 0)::float AS "validationPassRate",
        COALESCE((SELECT COUNT(*)::float FROM factory_editorial_reviews WHERE lifecycle IN ('editorially_approved', 'authority_prepared', 'governance_ready')) / NULLIF((SELECT COUNT(*)::float FROM factory_editorial_reviews), 0), 0)::float AS "editorialApprovalRate",
        COALESCE((SELECT COUNT(*)::float FROM factory_editorial_reviews WHERE lifecycle = 'revision_required') / NULLIF((SELECT COUNT(*)::float FROM factory_editorial_reviews), 0), 0)::float AS "revisionRate",
        COALESCE((SELECT COUNT(*)::float FROM factory_editorial_reviews WHERE lifecycle = 'governance_ready') / NULLIF((SELECT COUNT(*)::float FROM factory_editorial_reviews), 0), 0)::float AS "governanceReadinessRate",
        jsonb_build_object(
          'low', (SELECT COUNT(*)::int FROM factory_confidence_assessments WHERE confidence_level = 'low'),
          'medium', (SELECT COUNT(*)::int FROM factory_confidence_assessments WHERE confidence_level = 'medium'),
          'high', (SELECT COUNT(*)::int FROM factory_confidence_assessments WHERE confidence_level = 'high'),
          'verified', (SELECT COUNT(*)::int FROM factory_confidence_assessments WHERE confidence_level = 'verified')
        ) AS "confidenceDistribution"
    `;
    return row!;
  },

  async createObject(input: CreateFactoryObjectInput): Promise<FactoryObject> {
    const sql = getWriteSql("creating factory object");
    const [row] = await sql<FactoryObject[]>`
      INSERT INTO factory_objects (object_type, title, payload, provenance, created_by, updated_by)
      VALUES (${input.objectType}, ${input.title}, ${sql.json(input.payload as any)}, ${sql.json(input.provenance as any)}, ${input.actor}, ${input.actor})
      RETURNING
        id::text AS "objectId",
        object_type AS "objectType",
        title,
        payload,
        lifecycle,
        provenance,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async getObject(objectId: string): Promise<FactoryObject | null> {
    const sql = getWriteSql("loading factory object");
    const [row] = await sql<FactoryObject[]>`
      SELECT
        id::text AS "objectId",
        object_type AS "objectType",
        title,
        payload,
        lifecycle,
        provenance,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_objects
      WHERE id = ${objectId}
      LIMIT 1
    `;
    return row || null;
  },

  async transitionObject(objectId: string, lifecycle: FactoryObjectLifecycle, actor: string): Promise<FactoryObject> {
    const sql = getWriteSql("transitioning factory object");
    const [row] = await sql<FactoryObject[]>`
      UPDATE factory_objects
      SET lifecycle = ${lifecycle}, updated_by = ${actor}
      WHERE id = ${objectId}
      RETURNING
        id::text AS "objectId",
        object_type AS "objectType",
        title,
        payload,
        lifecycle,
        provenance,
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(404, "FACTORY_OBJECT_NOT_FOUND", "Factory object not found.");
    }
    return row;
  },

  async createArtifact(input: CreateFactoryArtifactInput): Promise<FactoryArtifact> {
    const sql = getWriteSql("creating factory artifact");
    const [row] = await sql<FactoryArtifact[]>`
      INSERT INTO factory_artifacts (
        factory_object_id,
        artifact_type,
        title,
        payload,
        authority_safe,
        model_provider,
        model_name,
        created_by
      )
      VALUES (
        ${input.factoryObjectId || null},
        ${input.artifactType},
        ${input.title},
        ${sql.json(input.payload as any)},
        ${input.authoritySafe},
        ${input.modelProvider || null},
        ${input.modelName || null},
        ${input.actor}
      )
      RETURNING
        id::text AS "artifactId",
        factory_object_id::text AS "factoryObjectId",
        artifact_type AS "artifactType",
        title,
        payload,
        authority_safe AS "authoritySafe",
        model_provider AS "modelProvider",
        model_name AS "modelName",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async getArtifactsByIds(artifactIds: string[]): Promise<FactoryArtifact[]> {
    if (artifactIds.length === 0) return [];
    const sql = getWriteSql("loading Factory artifacts by lineage");
    return sql<FactoryArtifact[]>`
      SELECT
        id::text AS "artifactId",
        factory_object_id::text AS "factoryObjectId",
        artifact_type AS "artifactType",
        title,
        payload,
        authority_safe AS "authoritySafe",
        model_provider AS "modelProvider",
        model_name AS "modelName",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM factory_artifacts
      WHERE id = ANY(${artifactIds}::uuid[])
      ORDER BY created_at, id
    `;
  },

  async createPackageDraft(input: CreateFactoryPackageDraftInput): Promise<FactoryPackageDraft> {
    const sql = getWriteSql("creating factory package draft");
    const packageDraftId = randomUUID();
    const supersededDraft = input.supersedesPackageId ? await factoryRepository.getPackageDraft(input.supersedesPackageId) : null;
    const lineageRootId = supersededDraft?.lineageRootId || input.supersedesPackageId || packageDraftId;
    const [row] = await sql<FactoryPackageDraft[]>`
      INSERT INTO factory_package_drafts (
        id,
        title,
        description,
        package_type,
        factory_object_refs,
        artifact_refs,
        validated_evidence_refs,
        risk_summary,
        lineage_root_id,
        supersedes_package_id,
        created_by,
        updated_by
      )
      VALUES (
        ${packageDraftId},
        ${input.title},
        ${input.description},
        ${input.packageType},
        ${sql.json(input.factoryObjectRefs as any)},
        ${sql.json(input.artifactRefs as any)},
        ${sql.json((input.validatedEvidenceRefs || []) as any)},
        ${sql.json(input.riskSummary as any)},
        ${lineageRootId === packageDraftId ? null : lineageRootId},
        ${input.supersedesPackageId || null},
        ${input.actor},
        ${input.actor}
      )
      RETURNING
        id::text AS "packageDraftId",
        title,
        description,
        package_type AS "packageType",
        factory_object_refs AS "factoryObjectRefs",
        artifact_refs AS "artifactRefs",
        validated_evidence_refs AS "validatedEvidenceRefs",
        risk_summary AS "riskSummary",
        lifecycle,
        COALESCE(lineage_root_id, id)::text AS "lineageRootId",
        supersedes_package_id::text AS "supersedesPackageId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async getPackageDraft(packageDraftId: string): Promise<FactoryPackageDraft | null> {
    const sql = getWriteSql("loading factory package draft");
    const [row] = await sql<FactoryPackageDraft[]>`
      SELECT
        id::text AS "packageDraftId",
        title,
        description,
        package_type AS "packageType",
        factory_object_refs AS "factoryObjectRefs",
        artifact_refs AS "artifactRefs",
        validated_evidence_refs AS "validatedEvidenceRefs",
        risk_summary AS "riskSummary",
        lifecycle,
        COALESCE(lineage_root_id, id)::text AS "lineageRootId",
        supersedes_package_id::text AS "supersedesPackageId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_package_drafts
      WHERE id = ${packageDraftId}
      LIMIT 1
    `;
    return row || null;
  },

  async transitionPackageDraft(packageDraftId: string, lifecycle: FactoryPackageDraftLifecycle, actor: string): Promise<FactoryPackageDraft> {
    const sql = getWriteSql("transitioning factory package draft");
    const [row] = await sql<FactoryPackageDraft[]>`
      UPDATE factory_package_drafts
      SET lifecycle = ${lifecycle}, updated_by = ${actor}
      WHERE id = ${packageDraftId}
      RETURNING
        id::text AS "packageDraftId",
        title,
        description,
        package_type AS "packageType",
        factory_object_refs AS "factoryObjectRefs",
        artifact_refs AS "artifactRefs",
        validated_evidence_refs AS "validatedEvidenceRefs",
        risk_summary AS "riskSummary",
        lifecycle,
        COALESCE(lineage_root_id, id)::text AS "lineageRootId",
        supersedes_package_id::text AS "supersedesPackageId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    }
    return row;
  },

  async getLatestPackageVersion(lineageRootId: string): Promise<FactoryPackageVersion | null> {
    const sql = getWriteSql("loading latest factory package version");
    const [row] = await sql<FactoryPackageVersion[]>`
      SELECT
        id::text AS "packageVersionId",
        draft_id::text AS "draftId",
        lineage_root_id::text AS "lineageRootId",
        version::int,
        supersedes_version_id::text AS "supersedesVersionId",
        package_snapshot AS "packageSnapshot",
        snapshot_hash AS "snapshotHash",
        validated_evidence_refs AS "validatedEvidenceRefs",
        lifecycle,
        governance_publication_package_id::text AS "governancePublicationPackageId",
        feedback_package_refs AS "feedbackPackageRefs",
        revision_plan_id::text AS "revisionPlanId",
        source_feedback_package_id::text AS "sourceFeedbackPackageId",
        resubmission_audit_record_id::text AS "resubmissionAuditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt",
        submitted_at::text AS "submittedAt"
      FROM factory_package_versions
      WHERE lineage_root_id = ${lineageRootId}
      ORDER BY version DESC
      LIMIT 1
    `;
    return row || null;
  },

  async getPackageVersion(packageVersionId: string): Promise<FactoryPackageVersion | null> {
    const sql = getWriteSql("loading factory package version");
    const [row] = await sql<FactoryPackageVersion[]>`
      SELECT
        id::text AS "packageVersionId",
        draft_id::text AS "draftId",
        lineage_root_id::text AS "lineageRootId",
        version::int,
        supersedes_version_id::text AS "supersedesVersionId",
        package_snapshot AS "packageSnapshot",
        snapshot_hash AS "snapshotHash",
        validated_evidence_refs AS "validatedEvidenceRefs",
        lifecycle,
        governance_publication_package_id::text AS "governancePublicationPackageId",
        feedback_package_refs AS "feedbackPackageRefs",
        revision_plan_id::text AS "revisionPlanId",
        source_feedback_package_id::text AS "sourceFeedbackPackageId",
        resubmission_audit_record_id::text AS "resubmissionAuditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt",
        submitted_at::text AS "submittedAt"
      FROM factory_package_versions
      WHERE id = ${packageVersionId}
      LIMIT 1
    `;
    return row || null;
  },

  async createPackageVersion(input: CreateFactoryPackageVersionInput): Promise<FactoryPackageVersion> {
    const sql = getWriteSql("creating factory package version");
    const latest = await factoryRepository.getLatestPackageVersion(input.draft.lineageRootId || input.draft.packageDraftId);
    const version = (latest?.version || 0) + 1;
    const lineageRootId = input.draft.lineageRootId || input.draft.packageDraftId;
    const snapshotHash = hashSnapshot(input.packageSnapshot);

    const [row] = await sql<FactoryPackageVersion[]>`
      INSERT INTO factory_package_versions (
        draft_id,
        lineage_root_id,
        version,
        supersedes_version_id,
        package_snapshot,
        snapshot_hash,
        validated_evidence_refs,
        feedback_package_refs,
        revision_plan_id,
        source_feedback_package_id,
        resubmission_audit_record_id,
        lifecycle,
        created_by
      )
      VALUES (
        ${input.draft.packageDraftId},
        ${lineageRootId},
        ${version},
        ${input.supersedesVersionId || latest?.packageVersionId || null},
        ${sql.json(input.packageSnapshot as any)},
        ${snapshotHash},
        ${sql.json(input.draft.validatedEvidenceRefs as any)},
        ${sql.json((input.feedbackPackageRefs || []) as any)},
        ${input.revisionPlanId || null},
        ${input.sourceFeedbackPackageId || null},
        ${input.resubmissionAuditRecordId || null},
        'draft',
        ${input.actor}
      )
      RETURNING
        id::text AS "packageVersionId",
        draft_id::text AS "draftId",
        lineage_root_id::text AS "lineageRootId",
        version::int,
        supersedes_version_id::text AS "supersedesVersionId",
        package_snapshot AS "packageSnapshot",
        snapshot_hash AS "snapshotHash",
        validated_evidence_refs AS "validatedEvidenceRefs",
        lifecycle,
        governance_publication_package_id::text AS "governancePublicationPackageId",
        feedback_package_refs AS "feedbackPackageRefs",
        revision_plan_id::text AS "revisionPlanId",
        source_feedback_package_id::text AS "sourceFeedbackPackageId",
        resubmission_audit_record_id::text AS "resubmissionAuditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt",
        submitted_at::text AS "submittedAt"
    `;
    return row!;
  },

  async markPackageVersionSubmitted(packageVersionId: string, governancePublicationPackageId?: string | null): Promise<FactoryPackageVersion> {
    const sql = getWriteSql("marking factory package version submitted");
    const [row] = await sql<FactoryPackageVersion[]>`
      UPDATE factory_package_versions
      SET lifecycle = 'submitted_to_governance',
          governance_publication_package_id = ${governancePublicationPackageId || null},
          submitted_at = NOW()
      WHERE id = ${packageVersionId}
        AND lifecycle = 'draft'
      RETURNING
        id::text AS "packageVersionId",
        draft_id::text AS "draftId",
        lineage_root_id::text AS "lineageRootId",
        version::int,
        supersedes_version_id::text AS "supersedesVersionId",
        package_snapshot AS "packageSnapshot",
        snapshot_hash AS "snapshotHash",
        validated_evidence_refs AS "validatedEvidenceRefs",
        lifecycle,
        governance_publication_package_id::text AS "governancePublicationPackageId",
        feedback_package_refs AS "feedbackPackageRefs",
        revision_plan_id::text AS "revisionPlanId",
        source_feedback_package_id::text AS "sourceFeedbackPackageId",
        resubmission_audit_record_id::text AS "resubmissionAuditRecordId",
        created_by AS "createdBy",
        created_at::text AS "createdAt",
        submitted_at::text AS "submittedAt"
    `;
    if (!row) {
      throw new ApiError(409, "FACTORY_PACKAGE_VERSION_NOT_DRAFT", "Only draft Factory package versions can be submitted.");
    }
    return row;
  },

  async getGovernanceSubmissionByVersion(packageVersionId: string): Promise<FactoryGovernanceSubmission | null> {
    const sql = getWriteSql("loading factory governance submission");
    const [row] = await sql<FactoryGovernanceSubmission[]>`
      SELECT
        id::text AS "submissionId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        submission_actor AS "submissionActor",
        submission_reason AS "submissionReason",
        submission_audit_record_id::text AS "submissionAuditRecordId",
        created_at::text AS "createdAt"
      FROM factory_governance_submissions
      WHERE factory_package_version_id = ${packageVersionId}
      LIMIT 1
    `;
    return row || null;
  },

  async getGovernanceSubmissionByGovernancePackage(governancePublicationPackageId: string): Promise<FactoryGovernanceSubmission | null> {
    const sql = getWriteSql("loading factory governance submission by governance package");
    const [row] = await sql<FactoryGovernanceSubmission[]>`
      SELECT
        id::text AS "submissionId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        submission_actor AS "submissionActor",
        submission_reason AS "submissionReason",
        submission_audit_record_id::text AS "submissionAuditRecordId",
        created_at::text AS "createdAt"
      FROM factory_governance_submissions
      WHERE governance_publication_package_id = ${governancePublicationPackageId}
      LIMIT 1
    `;
    return row || null;
  },

  async createGovernanceSubmission(input: {
    factoryPackageVersionId: string;
    factoryPackageDraftId: string;
    factoryLineageRootId: string;
    governancePublicationPackageId: string;
    submissionActor: GovernanceActorRef;
    submissionReason: string;
    submissionAuditRecordId: string;
  }): Promise<FactoryGovernanceSubmission> {
    const sql = getWriteSql("creating factory governance submission");
    const [row] = await sql<FactoryGovernanceSubmission[]>`
      INSERT INTO factory_governance_submissions (
        factory_package_version_id,
        factory_package_draft_id,
        factory_lineage_root_id,
        governance_publication_package_id,
        submission_actor,
        submission_reason,
        submission_audit_record_id
      )
      VALUES (
        ${input.factoryPackageVersionId},
        ${input.factoryPackageDraftId},
        ${input.factoryLineageRootId},
        ${input.governancePublicationPackageId},
        ${sql.json(input.submissionActor as any)},
        ${input.submissionReason},
        ${input.submissionAuditRecordId}
      )
      RETURNING
        id::text AS "submissionId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        submission_actor AS "submissionActor",
        submission_reason AS "submissionReason",
        submission_audit_record_id::text AS "submissionAuditRecordId",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async getFeedbackConsumptionByFeedbackPackage(feedbackPackageId: string): Promise<FactoryFeedbackConsumption | null> {
    const sql = getWriteSql("loading factory feedback consumption");
    const [row] = await sql<FactoryFeedbackConsumption[]>`
      SELECT
        id::text AS "feedbackConsumptionId",
        feedback_package_id::text AS "feedbackPackageId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        affected_factory_object_ids AS "affectedFactoryObjectIds",
        classification,
        required_response AS "requiredResponse",
        lifecycle,
        revision_plan_id::text AS "revisionPlanId",
        resolution_record_id::text AS "resolutionRecordId",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_feedback_consumptions
      WHERE feedback_package_id = ${feedbackPackageId}
      LIMIT 1
    `;
    return row || null;
  },

  async getFeedbackConsumption(feedbackConsumptionId: string): Promise<FactoryFeedbackConsumption | null> {
    const sql = getWriteSql("loading factory feedback consumption by id");
    const [row] = await sql<FactoryFeedbackConsumption[]>`
      SELECT
        id::text AS "feedbackConsumptionId",
        feedback_package_id::text AS "feedbackPackageId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        affected_factory_object_ids AS "affectedFactoryObjectIds",
        classification,
        required_response AS "requiredResponse",
        lifecycle,
        revision_plan_id::text AS "revisionPlanId",
        resolution_record_id::text AS "resolutionRecordId",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_feedback_consumptions
      WHERE id = ${feedbackConsumptionId}
      LIMIT 1
    `;
    return row || null;
  },

  async createFeedbackConsumption(input: CreateFactoryFeedbackConsumptionInput): Promise<FactoryFeedbackConsumption> {
    const sql = getWriteSql("creating factory feedback consumption");
    const [row] = await sql<FactoryFeedbackConsumption[]>`
      INSERT INTO factory_feedback_consumptions (
        feedback_package_id,
        governance_publication_package_id,
        factory_package_version_id,
        factory_package_draft_id,
        factory_lineage_root_id,
        affected_factory_object_ids,
        classification,
        required_response,
        audit_record_id,
        created_by,
        updated_by
      )
      VALUES (
        ${input.feedbackPackageId},
        ${input.governancePublicationPackageId || null},
        ${input.factoryPackageVersionId || null},
        ${input.factoryPackageDraftId || null},
        ${input.factoryLineageRootId || null},
        ${sql.json(input.affectedFactoryObjectIds as any)},
        ${input.classification},
        ${input.requiredResponse},
        ${input.auditRecordId},
        ${input.actor},
        ${input.actor}
      )
      RETURNING
        id::text AS "feedbackConsumptionId",
        feedback_package_id::text AS "feedbackPackageId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        affected_factory_object_ids AS "affectedFactoryObjectIds",
        classification,
        required_response AS "requiredResponse",
        lifecycle,
        revision_plan_id::text AS "revisionPlanId",
        resolution_record_id::text AS "resolutionRecordId",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async transitionFeedbackConsumption(
    feedbackConsumptionId: string,
    lifecycle: FactoryFeedbackLifecycle,
    actor: string,
    revisionPlanId?: string | null,
    resolutionRecordId?: string | null
  ): Promise<FactoryFeedbackConsumption> {
    const sql = getWriteSql("transitioning factory feedback consumption");
    const [row] = await sql<FactoryFeedbackConsumption[]>`
      UPDATE factory_feedback_consumptions
      SET lifecycle = ${lifecycle},
          updated_by = ${actor},
          revision_plan_id = COALESCE(${revisionPlanId || null}, revision_plan_id),
          resolution_record_id = COALESCE(${resolutionRecordId || null}, resolution_record_id)
      WHERE id = ${feedbackConsumptionId}
      RETURNING
        id::text AS "feedbackConsumptionId",
        feedback_package_id::text AS "feedbackPackageId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        affected_factory_object_ids AS "affectedFactoryObjectIds",
        classification,
        required_response AS "requiredResponse",
        lifecycle,
        revision_plan_id::text AS "revisionPlanId",
        resolution_record_id::text AS "resolutionRecordId",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(404, "FACTORY_FEEDBACK_CONSUMPTION_NOT_FOUND", "Factory feedback consumption not found.");
    }
    return row;
  },

  async createRevisionPlan(input: CreateFactoryRevisionPlanInput): Promise<FactoryRevisionPlan> {
    const sql = getWriteSql("creating factory revision plan");
    const [row] = await sql<FactoryRevisionPlan[]>`
      INSERT INTO factory_revision_plans (
        feedback_consumption_id,
        feedback_package_id,
        factory_package_version_id,
        factory_package_draft_id,
        factory_lineage_root_id,
        affected_factory_object_ids,
        plan_summary,
        planned_actions,
        audit_record_id,
        created_by,
        updated_by
      )
      VALUES (
        ${input.feedbackConsumption.feedbackConsumptionId},
        ${input.feedbackConsumption.feedbackPackageId},
        ${input.feedbackConsumption.factoryPackageVersionId || null},
        ${input.feedbackConsumption.factoryPackageDraftId || null},
        ${input.feedbackConsumption.factoryLineageRootId || null},
        ${sql.json(input.feedbackConsumption.affectedFactoryObjectIds as any)},
        ${input.planSummary},
        ${sql.json(input.plannedActions as any)},
        ${input.auditRecordId},
        ${input.actor},
        ${input.actor}
      )
      RETURNING
        id::text AS "revisionPlanId",
        feedback_consumption_id::text AS "feedbackConsumptionId",
        feedback_package_id::text AS "feedbackPackageId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        affected_factory_object_ids AS "affectedFactoryObjectIds",
        plan_summary AS "planSummary",
        planned_actions AS "plannedActions",
        lifecycle,
        resubmission_package_draft_id::text AS "resubmissionPackageDraftId",
        superseded_package_version_id::text AS "supersededPackageVersionId",
        new_package_version_id::text AS "newPackageVersionId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        submission_audit_record_id::text AS "submissionAuditRecordId",
        revision_completion_record_id::text AS "revisionCompletionRecordId",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    return row!;
  },

  async getRevisionPlan(revisionPlanId: string): Promise<FactoryRevisionPlan | null> {
    const sql = getWriteSql("loading factory revision plan");
    const [row] = await sql<FactoryRevisionPlan[]>`
      SELECT
        id::text AS "revisionPlanId",
        feedback_consumption_id::text AS "feedbackConsumptionId",
        feedback_package_id::text AS "feedbackPackageId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        affected_factory_object_ids AS "affectedFactoryObjectIds",
        plan_summary AS "planSummary",
        planned_actions AS "plannedActions",
        lifecycle,
        resubmission_package_draft_id::text AS "resubmissionPackageDraftId",
        superseded_package_version_id::text AS "supersededPackageVersionId",
        new_package_version_id::text AS "newPackageVersionId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        submission_audit_record_id::text AS "submissionAuditRecordId",
        revision_completion_record_id::text AS "revisionCompletionRecordId",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
      FROM factory_revision_plans
      WHERE id = ${revisionPlanId}
      LIMIT 1
    `;
    return row || null;
  },

  async transitionRevisionPlan(
    revisionPlanId: string,
    lifecycle: FactoryRevisionPlanLifecycle,
    actor: string,
    resubmissionPackageDraftId?: string | null
  ): Promise<FactoryRevisionPlan> {
    const sql = getWriteSql("transitioning factory revision plan");
    const [row] = await sql<FactoryRevisionPlan[]>`
      UPDATE factory_revision_plans
      SET lifecycle = ${lifecycle},
          updated_by = ${actor},
          resubmission_package_draft_id = COALESCE(${resubmissionPackageDraftId || null}, resubmission_package_draft_id)
      WHERE id = ${revisionPlanId}
      RETURNING
        id::text AS "revisionPlanId",
        feedback_consumption_id::text AS "feedbackConsumptionId",
        feedback_package_id::text AS "feedbackPackageId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        affected_factory_object_ids AS "affectedFactoryObjectIds",
        plan_summary AS "planSummary",
        planned_actions AS "plannedActions",
        lifecycle,
        resubmission_package_draft_id::text AS "resubmissionPackageDraftId",
        superseded_package_version_id::text AS "supersededPackageVersionId",
        new_package_version_id::text AS "newPackageVersionId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        submission_audit_record_id::text AS "submissionAuditRecordId",
        revision_completion_record_id::text AS "revisionCompletionRecordId",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(404, "FACTORY_REVISION_PLAN_NOT_FOUND", "Factory revision plan not found.");
    }
    return row;
  },

  async completeRevisionPlan(input: {
    revisionPlanId: string;
    supersededPackageVersionId: string;
    newPackageVersionId: string;
    governancePublicationPackageId: string;
    submissionAuditRecordId: string;
    revisionCompletionRecordId: string;
    actor: string;
  }): Promise<FactoryRevisionPlan> {
    const sql = getWriteSql("completing factory revision plan");
    const [row] = await sql<FactoryRevisionPlan[]>`
      UPDATE factory_revision_plans
      SET lifecycle = 'resolved',
          updated_by = ${input.actor},
          superseded_package_version_id = ${input.supersededPackageVersionId},
          new_package_version_id = ${input.newPackageVersionId},
          governance_publication_package_id = ${input.governancePublicationPackageId},
          submission_audit_record_id = ${input.submissionAuditRecordId},
          revision_completion_record_id = ${input.revisionCompletionRecordId}
      WHERE id = ${input.revisionPlanId}
        AND new_package_version_id IS NULL
      RETURNING
        id::text AS "revisionPlanId",
        feedback_consumption_id::text AS "feedbackConsumptionId",
        feedback_package_id::text AS "feedbackPackageId",
        factory_package_version_id::text AS "factoryPackageVersionId",
        factory_package_draft_id::text AS "factoryPackageDraftId",
        factory_lineage_root_id::text AS "factoryLineageRootId",
        affected_factory_object_ids AS "affectedFactoryObjectIds",
        plan_summary AS "planSummary",
        planned_actions AS "plannedActions",
        lifecycle,
        resubmission_package_draft_id::text AS "resubmissionPackageDraftId",
        superseded_package_version_id::text AS "supersededPackageVersionId",
        new_package_version_id::text AS "newPackageVersionId",
        governance_publication_package_id::text AS "governancePublicationPackageId",
        submission_audit_record_id::text AS "submissionAuditRecordId",
        revision_completion_record_id::text AS "revisionCompletionRecordId",
        audit_record_id::text AS "auditRecordId",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at::text AS "createdAt",
        updated_at::text AS "updatedAt"
    `;
    if (!row) {
      throw new ApiError(409, "FACTORY_REVISION_PLAN_ALREADY_COMPLETED", "Factory revision plan already completed.");
    }
    return row;
  },

  async createAuditRecord(input: {
    targetRef: Record<string, unknown>;
    action: string;
    actor: string;
    reason: string;
    beforeState?: Record<string, unknown> | null;
    afterState: Record<string, unknown>;
  }): Promise<string> {
    const sql = getWriteSql("creating factory audit record");
    const [row] = await sql<Array<{ auditRecordId: string }>>`
      INSERT INTO factory_audit_records (target_ref, action, actor, reason, before_state, after_state)
      VALUES (
        ${sql.json(input.targetRef as any)},
        ${input.action},
        ${input.actor},
        ${input.reason},
        ${sql.json((input.beforeState || null) as any)},
        ${sql.json(input.afterState as any)}
      )
      RETURNING id::text AS "auditRecordId"
    `;
    return row!.auditRecordId;
  }
};
