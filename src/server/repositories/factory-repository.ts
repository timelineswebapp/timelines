import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";
import type {
  FactoryArtifact,
  FactoryArtifactType,
  FactoryFeedbackConsumption,
  FactoryFeedbackLifecycle,
  FactoryObject,
  FactoryObjectLifecycle,
  FactoryObjectType,
  FactoryPackageDraft,
  FactoryPackageDraftLifecycle,
  FactoryPackageRiskSummary,
  FactoryPackageType,
  FactoryPackageVersion,
  FactoryRevisionPlan,
  FactoryRevisionPlanLifecycle
} from "@/src/server/factory/contracts";
import type { GovernanceActorRef } from "@/src/server/governance/contracts";

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
