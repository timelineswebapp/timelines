import type {
  Approval,
  AuditRecord,
  Dispute,
  EvidenceRef,
  FeedbackPackage,
  GovernanceDecision,
  GovernanceQueue,
  PublicationPackage
} from "@/src/server/governance/contracts";
import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";
import { randomUUID } from "node:crypto";

type DecisionVerificationInput = {
  governanceDecisionId: string;
  expectedDecisionTypes: GovernanceDecision["decisionType"][];
  expectedAuthorityType: GovernanceDecision["targetAuthority"]["authorityType"];
  expectedAuthorityId?: string;
};

type PersistedDecision = GovernanceDecision & {
  approvedApprovalCount: number;
};

type TransitionAuditInput = {
  authorityRef: AuditRecord["authorityRef"];
  fromState: string;
  toState: string;
  actor: AuditRecord["reconstruction"]["actorChain"][number];
  reason: string;
  decisionRefs?: string[];
  approvalRefs?: string[];
  packageRefs?: string[];
  disputeRefs?: string[];
};

type ValidatedEvidenceLineageRow = {
  validationRecordId: string;
  evidenceRecordId: string;
  corpusDocumentExists: boolean;
  sourceSnapshotExists: boolean;
  sourceRecordExists: boolean;
  provenance: Record<string, unknown>;
};

function validatedEvidenceKey(evidence: EvidenceRef): string {
  return `${evidence.evidenceRecordId || ""}:${evidence.validationRecordId || ""}`;
}

export function extractValidatedEvidenceRefs(evidenceRefs: EvidenceRef[]): EvidenceRef[] {
  return evidenceRefs.filter((evidence) => evidence.evidenceType === "validated_evidence");
}

export async function verifyValidatedEvidenceRefs(evidenceRefs: EvidenceRef[], context: string): Promise<void> {
  const validatedEvidenceRefs = extractValidatedEvidenceRefs(evidenceRefs);
  if (validatedEvidenceRefs.length === 0) {
    throw new ApiError(409, "VALIDATED_EVIDENCE_REQUIRED", `${context} requires at least one validated source-grounded evidence reference.`);
  }

  const malformed = validatedEvidenceRefs.find((evidence) => !evidence.evidenceRecordId || !evidence.validationRecordId);
  if (malformed) {
    throw new ApiError(409, "VALIDATED_EVIDENCE_REFERENCE_INCOMPLETE", `${context} validated evidence must reference evidence_records and evidence_validation_records.`);
  }

  const sql = getWriteSql("verifying validated evidence lineage");
  const rows = await sql<ValidatedEvidenceLineageRow[]>`
    SELECT
      evidence_validation_records.id::text AS "validationRecordId",
      evidence_records.id::text AS "evidenceRecordId",
      (corpus_documents.id IS NOT NULL) AS "corpusDocumentExists",
      (source_authority_snapshots.id IS NOT NULL) AS "sourceSnapshotExists",
      (source_authority_records.id IS NOT NULL) AS "sourceRecordExists",
      evidence_validation_records.provenance
    FROM evidence_validation_records
    INNER JOIN evidence_records
      ON evidence_records.id = evidence_validation_records.evidence_record_id
    LEFT JOIN corpus_documents
      ON corpus_documents.id = evidence_records.corpus_document_id
    LEFT JOIN source_authority_snapshots
      ON source_authority_snapshots.id = evidence_records.source_snapshot_id
    LEFT JOIN source_authority_records
      ON source_authority_records.id = evidence_records.source_record_id
    WHERE evidence_validation_records.status = 'passed'
      AND evidence_validation_records.id = ANY(${validatedEvidenceRefs.map((evidence) => evidence.validationRecordId!)}::uuid[])
  `;

  const verified = new Map(rows.map((row) => [`${row.evidenceRecordId}:${row.validationRecordId}`, row]));
  for (const evidence of validatedEvidenceRefs) {
    const row = verified.get(validatedEvidenceKey(evidence));
    if (!row) {
      throw new ApiError(409, "VALIDATED_EVIDENCE_NOT_PASSED", `${context} references evidence without a passed validation record.`);
    }
    const provenance = row.provenance || {};
    if (
      !row.corpusDocumentExists ||
      !row.sourceSnapshotExists ||
      !row.sourceRecordExists ||
      provenance.authorityDecision !== false ||
      provenance.publicationReadinessDecision !== false
    ) {
      throw new ApiError(409, "VALIDATED_EVIDENCE_LINEAGE_INCOMPLETE", `${context} validated evidence lineage or validation provenance is incomplete.`);
    }
  }
}

export async function verifyApprovedGovernanceDecision(input: DecisionVerificationInput): Promise<GovernanceDecision> {
  const sql = getWriteSql("verifying governance decision");
  const [decision] = await sql<PersistedDecision[]>`
    SELECT
      governance_decisions.id::text AS "decisionId",
      governance_decisions.decision_type AS "decisionType",
      governance_decisions.target_authority AS "targetAuthority",
      governance_decisions.actor,
      governance_decisions.evidence_refs AS "evidenceRefs",
      governance_decisions.rationale,
      governance_decisions.approval_refs AS "approvalRefs",
      governance_decisions.escalation_refs AS "escalationRefs",
      governance_decisions.outcome,
      governance_decisions.lifecycle,
      governance_decisions.created_at::text AS "createdAt",
      governance_decisions.decided_at::text AS "decidedAt",
      COALESCE(approved_approvals.approved_count, 0)::int AS "approvedApprovalCount"
    FROM governance_decisions
    LEFT JOIN (
      SELECT decision_id, COUNT(*)::int AS approved_count
      FROM governance_approvals
      WHERE lifecycle = 'approved'
      GROUP BY decision_id
    ) approved_approvals ON approved_approvals.decision_id = governance_decisions.id
    WHERE governance_decisions.id = ${input.governanceDecisionId}
    LIMIT 1
  `;

  if (!decision) {
    throw new ApiError(409, "GOVERNANCE_DECISION_NOT_FOUND", "Referenced GovernanceDecision does not exist.");
  }
  if (decision.lifecycle !== "approved" || decision.outcome !== "approved") {
    throw new ApiError(409, "GOVERNANCE_DECISION_NOT_APPROVED", "Referenced GovernanceDecision is not approved.");
  }
  if (!input.expectedDecisionTypes.includes(decision.decisionType)) {
    throw new ApiError(409, "GOVERNANCE_DECISION_TYPE_MISMATCH", "Referenced GovernanceDecision type does not authorize this mutation.");
  }
  if (decision.targetAuthority.authorityType !== input.expectedAuthorityType) {
    throw new ApiError(409, "GOVERNANCE_DECISION_AUTHORITY_TYPE_MISMATCH", "Referenced GovernanceDecision targets a different authority type.");
  }
  if (input.expectedAuthorityId && decision.targetAuthority.authorityId !== input.expectedAuthorityId) {
    throw new ApiError(409, "GOVERNANCE_DECISION_TARGET_MISMATCH", "Referenced GovernanceDecision targets a different authority record.");
  }
  if (decision.approvalRefs.length === 0 || decision.approvedApprovalCount < 1) {
    throw new ApiError(409, "GOVERNANCE_DECISION_APPROVAL_REQUIRED", "Referenced GovernanceDecision lacks an approved approval chain.");
  }
  await verifyValidatedEvidenceRefs(decision.evidenceRefs, "Approved GovernanceDecision");

  return decision;
}

export const governanceRepository = {
  async listPublicationPackages(limit = 100): Promise<PublicationPackage[]> {
    const sql = getWriteSql("listing governance publication packages");
    return sql<PublicationPackage[]>`
      SELECT
        id::text AS "packageId",
        scope,
        included_authority AS "includedAuthority",
        validation_artifacts AS "validationArtifacts",
        decision_refs AS "decisionRefs",
        risk_summary AS "riskSummary",
        readiness_certification AS "readinessCertification",
        acceptance_outcome AS "acceptanceOutcome",
        CASE WHEN factory_package_version_id IS NULL THEN NULL ELSE json_build_object(
          'factoryPackageVersionId', factory_package_version_id::text,
          'factoryPackageDraftId', factory_package_draft_id::text,
          'factoryLineageRootId', factory_lineage_root_id::text,
          'submittedBy', submitted_by,
          'submittedAt', submitted_at::text,
          'submissionAuditRecordId', submission_audit_record_id::text
        ) END AS "factorySubmission",
        lifecycle
      FROM governance_publication_packages
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async listDecisions(limit = 100): Promise<GovernanceDecision[]> {
    const sql = getWriteSql("listing governance decisions");
    return sql<GovernanceDecision[]>`
      SELECT
        id::text AS "decisionId",
        decision_type AS "decisionType",
        target_authority AS "targetAuthority",
        actor,
        evidence_refs AS "evidenceRefs",
        rationale,
        approval_refs AS "approvalRefs",
        escalation_refs AS "escalationRefs",
        outcome,
        lifecycle,
        created_at::text AS "createdAt",
        decided_at::text AS "decidedAt"
      FROM governance_decisions
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async listFeedbackPackages(limit = 100): Promise<FeedbackPackage[]> {
    const sql = getWriteSql("listing governance feedback packages");
    return sql<FeedbackPackage[]>`
      SELECT
        id::text AS "feedbackPackageId",
        origin,
        affected_authority AS "affectedAuthority",
        correction_class AS "correctionClass",
        evidence,
        required_response AS "requiredResponse",
        severity,
        closure_requirements AS "closureRequirements",
        lifecycle
      FROM governance_feedback_packages
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async listAuditRecords(limit = 100): Promise<AuditRecord[]> {
    const sql = getWriteSql("listing governance audit records");
    return sql<AuditRecord[]>`
      SELECT
        id::text AS "auditRecordId",
        authority_ref AS "authorityRef",
        decision_refs AS "decisionRefs",
        approval_refs AS "approvalRefs",
        evidence_refs AS "evidenceRefs",
        package_refs AS "packageRefs",
        dispute_refs AS "disputeRefs",
        final_state AS "finalState",
        reconstruction
      FROM governance_audit_records
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async getDecision(decisionId: string): Promise<GovernanceDecision | null> {
    const sql = getWriteSql("loading governance decision");
    const [row] = await sql<GovernanceDecision[]>`
      SELECT
        id::text AS "decisionId",
        decision_type AS "decisionType",
        target_authority AS "targetAuthority",
        actor,
        evidence_refs AS "evidenceRefs",
        rationale,
        approval_refs AS "approvalRefs",
        escalation_refs AS "escalationRefs",
        outcome,
        lifecycle,
        created_at::text AS "createdAt",
        decided_at::text AS "decidedAt"
      FROM governance_decisions
      WHERE id = ${decisionId}
      LIMIT 1
    `;
    return row || null;
  },

  async getApproval(approvalId: string): Promise<Approval | null> {
    const sql = getWriteSql("loading governance approval");
    const [row] = await sql<Approval[]>`
      SELECT
        id::text AS "approvalId",
        decision_id AS "decisionId",
        request,
        steps,
        lifecycle,
        created_at::text AS "createdAt",
        completed_at::text AS "completedAt"
      FROM governance_approvals
      WHERE id = ${approvalId}
      LIMIT 1
    `;
    return row || null;
  },

  async hasApprovedApprovalChain(decisionId: string): Promise<boolean> {
    const sql = getWriteSql("verifying approval chain");
    const [row] = await sql<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM governance_approvals
      WHERE decision_id = ${decisionId}
        AND lifecycle = 'approved'
    `;
    return (row?.count || 0) > 0;
  },

  async createTransitionAudit(input: TransitionAuditInput): Promise<AuditRecord> {
    return governanceRepository.createAuditRecord({
      auditRecordId: randomUUID(),
      authorityRef: input.authorityRef,
      decisionRefs: input.decisionRefs || [],
      approvalRefs: input.approvalRefs || [],
      evidenceRefs: [],
      packageRefs: input.packageRefs || [],
      disputeRefs: input.disputeRefs || [],
      finalState: input.toState,
      reconstruction: {
        actorChain: [input.actor],
        stateTransitions: [
          {
            fromState: input.fromState,
            toState: input.toState,
            changedBy: input.actor,
            decisionId: input.decisionRefs?.[0],
            approvalId: input.approvalRefs?.[0],
            reason: input.reason
          }
        ]
      }
    });
  },

  async transitionDecision(
    decisionId: string,
    lifecycle: GovernanceDecision["lifecycle"],
    outcome: GovernanceDecision["outcome"] | null
  ): Promise<GovernanceDecision> {
    const sql = getWriteSql("transitioning governance decision");
    const [row] = await sql<GovernanceDecision[]>`
      UPDATE governance_decisions
      SET lifecycle = ${lifecycle},
          outcome = COALESCE(${outcome}, outcome),
          decided_at = CASE WHEN ${lifecycle} IN ('approved', 'rejected', 'superseded') THEN NOW() ELSE decided_at END
      WHERE id = ${decisionId}
      RETURNING
        id::text AS "decisionId",
        decision_type AS "decisionType",
        target_authority AS "targetAuthority",
        actor,
        evidence_refs AS "evidenceRefs",
        rationale,
        approval_refs AS "approvalRefs",
        escalation_refs AS "escalationRefs",
        outcome,
        lifecycle,
        created_at::text AS "createdAt",
        decided_at::text AS "decidedAt"
    `;
    if (!row) {
      throw new ApiError(404, "GOVERNANCE_DECISION_NOT_FOUND", "GovernanceDecision not found.");
    }
    return row;
  },

  async transitionApproval(approval: Approval): Promise<Approval> {
    const sql = getWriteSql("transitioning governance approval");
    const [row] = await sql<Approval[]>`
      UPDATE governance_approvals
      SET steps = ${sql.json(approval.steps as any)},
          lifecycle = ${approval.lifecycle},
          completed_at = CASE WHEN ${approval.lifecycle} IN ('approved', 'rejected', 'expired') THEN NOW() ELSE completed_at END
      WHERE id = ${approval.approvalId}
      RETURNING
        id::text AS "approvalId",
        decision_id AS "decisionId",
        request,
        steps,
        lifecycle,
        created_at::text AS "createdAt",
        completed_at::text AS "completedAt"
    `;
    if (!row) {
      throw new ApiError(404, "APPROVAL_NOT_FOUND", "Approval not found.");
    }
    return row;
  },

  async transitionQueue(queueId: string, lifecycle: GovernanceQueue["lifecycle"]): Promise<GovernanceQueue> {
    const sql = getWriteSql("transitioning governance queue");
    const [row] = await sql<GovernanceQueue[]>`
      UPDATE governance_queues
      SET lifecycle = ${lifecycle}
      WHERE id = ${queueId}
      RETURNING
        id::text AS "queueId",
        queue_type AS "queueType",
        owner_service AS "ownerService",
        owner_role AS "ownerRole",
        target_authority AS "targetAuthority",
        allowed_actions AS "allowedActions",
        decision_refs AS "decisionRefs",
        audit_refs AS "auditRefs",
        lifecycle
    `;
    if (!row) {
      throw new ApiError(404, "GOVERNANCE_QUEUE_NOT_FOUND", "GovernanceQueue not found.");
    }
    return row;
  },

  async getQueue(queueId: string): Promise<GovernanceQueue | null> {
    const sql = getWriteSql("loading governance queue");
    const [row] = await sql<GovernanceQueue[]>`
      SELECT
        id::text AS "queueId",
        queue_type AS "queueType",
        owner_service AS "ownerService",
        owner_role AS "ownerRole",
        target_authority AS "targetAuthority",
        allowed_actions AS "allowedActions",
        decision_refs AS "decisionRefs",
        audit_refs AS "auditRefs",
        lifecycle
      FROM governance_queues
      WHERE id = ${queueId}
      LIMIT 1
    `;
    return row || null;
  },

  async createDecision(input: GovernanceDecision): Promise<GovernanceDecision> {
    const sql = getWriteSql("creating governance decision");
    const [row] = await sql<GovernanceDecision[]>`
      INSERT INTO governance_decisions (
        id,
        decision_type,
        target_authority,
        actor,
        evidence_refs,
        rationale,
        approval_refs,
        escalation_refs,
        outcome,
        lifecycle
      )
      VALUES (
        ${input.decisionId},
        ${input.decisionType},
        ${sql.json(input.targetAuthority as any)},
        ${sql.json(input.actor as any)},
        ${sql.json(input.evidenceRefs as any)},
        ${sql.json(input.rationale as any)},
        ${sql.json(input.approvalRefs as any)},
        ${sql.json(input.escalationRefs as any)},
        ${input.outcome},
        ${input.lifecycle}
      )
      RETURNING
        id::text AS "decisionId",
        decision_type AS "decisionType",
        target_authority AS "targetAuthority",
        actor,
        evidence_refs AS "evidenceRefs",
        rationale,
        approval_refs AS "approvalRefs",
        escalation_refs AS "escalationRefs",
        outcome,
        lifecycle,
        created_at::text AS "createdAt",
        decided_at::text AS "decidedAt"
    `;
    return row!;
  },

  async createApproval(input: Approval): Promise<Approval> {
    const sql = getWriteSql("creating governance approval");
    const [row] = await sql<Approval[]>`
      INSERT INTO governance_approvals (id, decision_id, request, steps, lifecycle)
      VALUES (${input.approvalId}, ${input.decisionId}, ${sql.json(input.request as any)}, ${sql.json(input.steps as any)}, ${input.lifecycle})
      RETURNING
        id::text AS "approvalId",
        decision_id AS "decisionId",
        request,
        steps,
        lifecycle,
        created_at::text AS "createdAt",
        completed_at::text AS "completedAt"
    `;
    return row!;
  },

  async createQueue(input: GovernanceQueue): Promise<GovernanceQueue> {
    const sql = getWriteSql("creating governance queue");
    const [row] = await sql<GovernanceQueue[]>`
      INSERT INTO governance_queues (
        id,
        queue_type,
        owner_service,
        owner_role,
        target_authority,
        allowed_actions,
        decision_refs,
        audit_refs,
        lifecycle
      )
      VALUES (
        ${input.queueId},
        ${input.queueType},
        ${input.ownerService},
        ${input.ownerRole},
        ${sql.json(input.targetAuthority as any)},
        ${sql.json(input.allowedActions as any)},
        ${sql.json(input.decisionRefs as any)},
        ${sql.json(input.auditRefs as any)},
        ${input.lifecycle}
      )
      RETURNING
        id::text AS "queueId",
        queue_type AS "queueType",
        owner_service AS "ownerService",
        owner_role AS "ownerRole",
        target_authority AS "targetAuthority",
        allowed_actions AS "allowedActions",
        decision_refs AS "decisionRefs",
        audit_refs AS "auditRefs",
        lifecycle
    `;
    return row!;
  },

  async createPublicationPackage(input: PublicationPackage): Promise<PublicationPackage> {
    const sql = getWriteSql("creating publication package");
    const [row] = await sql<PublicationPackage[]>`
      INSERT INTO governance_publication_packages (
        id,
        scope,
        included_authority,
        validation_artifacts,
        decision_refs,
        risk_summary,
        readiness_certification,
        acceptance_outcome,
        lifecycle,
        factory_package_version_id,
        factory_package_draft_id,
        factory_lineage_root_id,
        submitted_by,
        submitted_at,
        submission_audit_record_id
      )
      VALUES (
        ${input.packageId},
        ${sql.json(input.scope as any)},
        ${sql.json(input.includedAuthority as any)},
        ${sql.json(input.validationArtifacts as any)},
        ${sql.json(input.decisionRefs as any)},
        ${sql.json(input.riskSummary as any)},
        ${sql.json((input.readinessCertification || null) as any)},
        ${input.acceptanceOutcome || null},
        ${input.lifecycle},
        ${input.factorySubmission?.factoryPackageVersionId || null},
        ${input.factorySubmission?.factoryPackageDraftId || null},
        ${input.factorySubmission?.factoryLineageRootId || null},
        ${sql.json((input.factorySubmission?.submittedBy || null) as any)},
        ${input.factorySubmission?.submittedAt || null},
        ${input.factorySubmission?.submissionAuditRecordId || null}
      )
      RETURNING
        id::text AS "packageId",
        scope,
        included_authority AS "includedAuthority",
        validation_artifacts AS "validationArtifacts",
        decision_refs AS "decisionRefs",
        risk_summary AS "riskSummary",
        readiness_certification AS "readinessCertification",
        acceptance_outcome AS "acceptanceOutcome",
        CASE WHEN factory_package_version_id IS NULL THEN NULL ELSE json_build_object(
          'factoryPackageVersionId', factory_package_version_id::text,
          'factoryPackageDraftId', factory_package_draft_id::text,
          'factoryLineageRootId', factory_lineage_root_id::text,
          'submittedBy', submitted_by,
          'submittedAt', submitted_at::text,
          'submissionAuditRecordId', submission_audit_record_id::text
        ) END AS "factorySubmission",
        lifecycle
    `;
    return row!;
  },

  async getPublicationPackage(packageId: string): Promise<PublicationPackage | null> {
    const sql = getWriteSql("loading publication package");
    const [row] = await sql<PublicationPackage[]>`
      SELECT
        id::text AS "packageId",
        scope,
        included_authority AS "includedAuthority",
        validation_artifacts AS "validationArtifacts",
        decision_refs AS "decisionRefs",
        risk_summary AS "riskSummary",
        readiness_certification AS "readinessCertification",
        acceptance_outcome AS "acceptanceOutcome",
        CASE WHEN factory_package_version_id IS NULL THEN NULL ELSE json_build_object(
          'factoryPackageVersionId', factory_package_version_id::text,
          'factoryPackageDraftId', factory_package_draft_id::text,
          'factoryLineageRootId', factory_lineage_root_id::text,
          'submittedBy', submitted_by,
          'submittedAt', submitted_at::text,
          'submissionAuditRecordId', submission_audit_record_id::text
        ) END AS "factorySubmission",
        lifecycle
      FROM governance_publication_packages
      WHERE id = ${packageId}
      LIMIT 1
    `;
    return row || null;
  },

  async transitionPublicationPackage(input: PublicationPackage): Promise<PublicationPackage> {
    const sql = getWriteSql("transitioning publication package");
    const [row] = await sql<PublicationPackage[]>`
      UPDATE governance_publication_packages
      SET lifecycle = ${input.lifecycle},
          decision_refs = ${sql.json(input.decisionRefs as any)},
          readiness_certification = ${sql.json((input.readinessCertification || null) as any)},
          acceptance_outcome = ${input.acceptanceOutcome || null}
      WHERE id = ${input.packageId}
      RETURNING
        id::text AS "packageId",
        scope,
        included_authority AS "includedAuthority",
        validation_artifacts AS "validationArtifacts",
        decision_refs AS "decisionRefs",
        risk_summary AS "riskSummary",
        readiness_certification AS "readinessCertification",
        acceptance_outcome AS "acceptanceOutcome",
        CASE WHEN factory_package_version_id IS NULL THEN NULL ELSE json_build_object(
          'factoryPackageVersionId', factory_package_version_id::text,
          'factoryPackageDraftId', factory_package_draft_id::text,
          'factoryLineageRootId', factory_lineage_root_id::text,
          'submittedBy', submitted_by,
          'submittedAt', submitted_at::text,
          'submissionAuditRecordId', submission_audit_record_id::text
        ) END AS "factorySubmission",
        lifecycle
    `;
    if (!row) {
      throw new ApiError(404, "PUBLICATION_PACKAGE_NOT_FOUND", "PublicationPackage not found.");
    }
    return row;
  },

  async createFeedbackPackage(input: FeedbackPackage): Promise<FeedbackPackage> {
    const sql = getWriteSql("creating feedback package");
    const [row] = await sql<FeedbackPackage[]>`
      INSERT INTO governance_feedback_packages (
        id,
        origin,
        affected_authority,
        correction_class,
        evidence,
        required_response,
        severity,
        closure_requirements,
        lifecycle
      )
      VALUES (
        ${input.feedbackPackageId},
        ${sql.json(input.origin as any)},
        ${sql.json(input.affectedAuthority as any)},
        ${input.correctionClass},
        ${sql.json(input.evidence as any)},
        ${input.requiredResponse},
        ${input.severity},
        ${sql.json(input.closureRequirements as any)},
        ${input.lifecycle}
      )
      RETURNING
        id::text AS "feedbackPackageId",
        origin,
        affected_authority AS "affectedAuthority",
        correction_class AS "correctionClass",
        evidence,
        required_response AS "requiredResponse",
        severity,
        closure_requirements AS "closureRequirements",
        lifecycle
    `;
    return row!;
  },

  async getFeedbackPackage(feedbackPackageId: string): Promise<FeedbackPackage | null> {
    const sql = getWriteSql("loading feedback package");
    const [row] = await sql<FeedbackPackage[]>`
      SELECT
        id::text AS "feedbackPackageId",
        origin,
        affected_authority AS "affectedAuthority",
        correction_class AS "correctionClass",
        evidence,
        required_response AS "requiredResponse",
        severity,
        closure_requirements AS "closureRequirements",
        lifecycle
      FROM governance_feedback_packages
      WHERE id = ${feedbackPackageId}
      LIMIT 1
    `;
    return row || null;
  },

  async transitionFeedbackPackage(feedbackPackageId: string, lifecycle: FeedbackPackage["lifecycle"]): Promise<FeedbackPackage> {
    const sql = getWriteSql("transitioning feedback package");
    const [row] = await sql<FeedbackPackage[]>`
      UPDATE governance_feedback_packages
      SET lifecycle = ${lifecycle},
          closed_at = CASE WHEN ${lifecycle} = 'closed' THEN NOW() ELSE closed_at END
      WHERE id = ${feedbackPackageId}
      RETURNING
        id::text AS "feedbackPackageId",
        origin,
        affected_authority AS "affectedAuthority",
        correction_class AS "correctionClass",
        evidence,
        required_response AS "requiredResponse",
        severity,
        closure_requirements AS "closureRequirements",
        lifecycle
    `;
    if (!row) {
      throw new ApiError(404, "FEEDBACK_PACKAGE_NOT_FOUND", "FeedbackPackage not found.");
    }
    return row;
  },

  async createDispute(input: Dispute): Promise<Dispute> {
    const sql = getWriteSql("creating governance dispute");
    const [row] = await sql<Dispute[]>`
      INSERT INTO governance_disputes (
        id,
        target_authority,
        dispute_class,
        evidence_bundle,
        severity,
        resolution_path,
        outcome,
        lifecycle
      )
      VALUES (
        ${input.disputeId},
        ${sql.json(input.targetAuthority as any)},
        ${input.disputeClass},
        ${sql.json(input.evidenceBundle as any)},
        ${input.severity},
        ${input.resolutionPath},
        ${input.outcome || null},
        ${input.lifecycle}
      )
      RETURNING
        id::text AS "disputeId",
        target_authority AS "targetAuthority",
        dispute_class AS "disputeClass",
        evidence_bundle AS "evidenceBundle",
        severity,
        resolution_path AS "resolutionPath",
        outcome,
        lifecycle
    `;
    return row!;
  },

  async getDispute(disputeId: string): Promise<Dispute | null> {
    const sql = getWriteSql("loading governance dispute");
    const [row] = await sql<Dispute[]>`
      SELECT
        id::text AS "disputeId",
        target_authority AS "targetAuthority",
        dispute_class AS "disputeClass",
        evidence_bundle AS "evidenceBundle",
        severity,
        resolution_path AS "resolutionPath",
        outcome,
        lifecycle
      FROM governance_disputes
      WHERE id = ${disputeId}
      LIMIT 1
    `;
    return row || null;
  },

  async transitionDispute(input: Dispute): Promise<Dispute> {
    const sql = getWriteSql("transitioning governance dispute");
    const [row] = await sql<Dispute[]>`
      UPDATE governance_disputes
      SET lifecycle = ${input.lifecycle},
          outcome = ${input.outcome || null},
          resolved_at = CASE WHEN ${input.lifecycle} IN ('resolved_upheld', 'resolved_rejected', 'resolved_amended') THEN NOW() ELSE resolved_at END
      WHERE id = ${input.disputeId}
      RETURNING
        id::text AS "disputeId",
        target_authority AS "targetAuthority",
        dispute_class AS "disputeClass",
        evidence_bundle AS "evidenceBundle",
        severity,
        resolution_path AS "resolutionPath",
        outcome,
        lifecycle
    `;
    if (!row) {
      throw new ApiError(404, "DISPUTE_NOT_FOUND", "Dispute not found.");
    }
    return row;
  },

  async createAuditRecord(input: AuditRecord): Promise<AuditRecord> {
    const sql = getWriteSql("creating governance audit record");
    const [row] = await sql<AuditRecord[]>`
      INSERT INTO governance_audit_records (
        id,
        authority_ref,
        decision_refs,
        approval_refs,
        evidence_refs,
        package_refs,
        dispute_refs,
        final_state,
        reconstruction
      )
      VALUES (
        ${input.auditRecordId},
        ${sql.json(input.authorityRef as any)},
        ${sql.json(input.decisionRefs as any)},
        ${sql.json(input.approvalRefs as any)},
        ${sql.json(input.evidenceRefs as any)},
        ${sql.json(input.packageRefs as any)},
        ${sql.json(input.disputeRefs as any)},
        ${input.finalState},
        ${sql.json(input.reconstruction as any)}
      )
      RETURNING
        id::text AS "auditRecordId",
        authority_ref AS "authorityRef",
        decision_refs AS "decisionRefs",
        approval_refs AS "approvalRefs",
        evidence_refs AS "evidenceRefs",
        package_refs AS "packageRefs",
        dispute_refs AS "disputeRefs",
        final_state AS "finalState",
        reconstruction
    `;
    return row!;
  }
};
