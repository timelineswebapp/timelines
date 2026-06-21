export type GovernanceServiceBoundary = "factory" | "governance" | "historical_library" | "registry" | "platform";

export type GovernanceRole =
  | "factory_editor"
  | "governance_reviewer"
  | "senior_governance_reviewer"
  | "library_editor"
  | "registry_operator"
  | "auditor";

export type AuthorityType =
  | "historical_object"
  | "participation"
  | "publication_package"
  | "feedback_package"
  | "dispute";

export type AuthorityRef = {
  authorityType: AuthorityType;
  authorityId: string;
};

export type GovernanceActorRef = {
  actorId: string;
  role: GovernanceRole;
  institutionId: string;
};

export type EvidenceRef = {
  evidenceId: string;
  evidenceType:
    | "source"
    | "factory_validation"
    | "library_review"
    | "audit_record"
    | "dispute_submission"
    | "governance_note";
  uri?: string;
  authoritySafe: boolean;
};

export type GovernanceDecisionType =
  | "ADMIT_HISTORICAL_OBJECT"
  | "REVISE_HISTORICAL_OBJECT"
  | "MERGE_HISTORICAL_OBJECT"
  | "RETIRE_HISTORICAL_OBJECT"
  | "PRESERVE_HISTORICAL_OBJECT"
  | "ADMIT_PARTICIPATION"
  | "REVISE_PARTICIPATION"
  | "CHANGE_PARTICIPATION_PRIORITY"
  | "RETIRE_PARTICIPATION"
  | "CERTIFY_PUBLICATION_READINESS"
  | "ACCEPT_PUBLICATION_PACKAGE"
  | "REJECT_PUBLICATION_PACKAGE"
  | "RETURN_PUBLICATION_PACKAGE"
  | "CREATE_FEEDBACK_PACKAGE"
  | "CLOSE_FEEDBACK_PACKAGE"
  | "OPEN_DISPUTE"
  | "RESOLVE_DISPUTE"
  | "ESCALATE_AUTHORITY_REVIEW";

export type GovernanceDecisionLifecycleState =
  | "draft"
  | "submitted"
  | "under_review"
  | "approval_pending"
  | "approved"
  | "rejected"
  | "returned_for_revision"
  | "escalated"
  | "superseded"
  | "preserved";

export type GovernanceDecisionOutcome =
  | "approved"
  | "rejected"
  | "returned_for_revision"
  | "escalated"
  | "superseded"
  | "no_action";

export type GovernanceDecision = {
  decisionId: string;
  decisionType: GovernanceDecisionType;
  targetAuthority: AuthorityRef;
  actor: GovernanceActorRef;
  evidenceRefs: EvidenceRef[];
  rationale: {
    summary: string;
    authorityBasis: string[];
    riskNotes?: string[];
  };
  approvalRefs: string[];
  escalationRefs: string[];
  outcome: GovernanceDecisionOutcome;
  lifecycle: GovernanceDecisionLifecycleState;
  createdAt?: string;
  decidedAt?: string | null;
};

export type ApprovalLifecycleState =
  | "requested"
  | "pending"
  | "partially_approved"
  | "approved"
  | "rejected"
  | "returned_for_revision"
  | "escalated"
  | "expired"
  | "preserved";

export type ApprovalOutcome = "approved" | "rejected" | "returned_for_revision" | "escalated";

export type Approval = {
  approvalId: string;
  decisionId: string;
  request: {
    requestedBy: GovernanceActorRef;
    requestedRole: GovernanceRole;
    targetAuthority: AuthorityRef;
    reason: string;
  };
  steps: Array<{
    stepId: string;
    sequence: number;
    requiredRole: GovernanceRole;
    approver?: GovernanceActorRef;
    outcome?: ApprovalOutcome;
    reason?: string;
    decidedAt?: string;
  }>;
  lifecycle: ApprovalLifecycleState;
  createdAt?: string;
  completedAt?: string | null;
};

export type GovernanceQueueType =
  | "object_intake"
  | "object_validation"
  | "participation_intake"
  | "participation_priority_review"
  | "publication_readiness"
  | "library_review"
  | "feedback_return"
  | "dispute_triage"
  | "escalation_review"
  | "audit_review";

export type GovernanceQueueAction =
  | "submit"
  | "validate"
  | "request_revision"
  | "approve"
  | "reject"
  | "escalate"
  | "certify_ready"
  | "accept"
  | "return_to_factory"
  | "close"
  | "preserve";

export type GovernanceQueue = {
  queueId: string;
  queueType: GovernanceQueueType;
  ownerService: GovernanceServiceBoundary;
  ownerRole: GovernanceRole;
  targetAuthority: AuthorityRef;
  allowedActions: GovernanceQueueAction[];
  decisionRefs: string[];
  auditRefs: string[];
  lifecycle: "entered" | "in_review" | "blocked" | "exited" | "preserved";
};

export type PublicationPackageLifecycleState =
  | "factory_draft"
  | "factory_validating"
  | "factory_ready"
  | "governance_review"
  | "readiness_certified"
  | "library_review"
  | "accepted"
  | "rejected"
  | "returned_for_revision"
  | "published"
  | "preserved";

export type PublicationPackage = {
  packageId: string;
  scope: {
    packageType:
      | "historical_object_publication"
      | "participation_publication"
      | "timeline_context_publication"
      | "mixed_authority_publication";
    description: string;
  };
  includedAuthority: AuthorityRef[];
  validationArtifacts: EvidenceRef[];
  decisionRefs: string[];
  riskSummary: {
    unresolvedAuthorityRisks: string[];
    disputeRefs: string[];
    validationWarnings: string[];
    publicationBlockers: string[];
  };
  readinessCertification?: {
    certifiedBy: GovernanceActorRef;
    decisionId: string;
    readinessStatus: "ready" | "blocked" | "conditional";
  };
  acceptanceOutcome?: "accepted" | "rejected" | "returned_for_revision" | "accepted_with_notes";
  factorySubmission?: {
    factoryPackageVersionId: string;
    factoryPackageDraftId: string;
    factoryLineageRootId: string;
    submittedBy: GovernanceActorRef;
    submittedAt?: string | null;
    submissionAuditRecordId: string;
  };
  lifecycle: PublicationPackageLifecycleState;
};

export type FeedbackPackageLifecycleState =
  | "created"
  | "delivered_to_factory"
  | "acknowledged"
  | "factory_reviewing"
  | "action_required"
  | "informational"
  | "resolved"
  | "closed"
  | "preserved";

export type FeedbackPackage = {
  feedbackPackageId: string;
  origin: {
    originService: "historical_library" | "governance" | "audit";
    originActor: GovernanceActorRef;
    sourcePackageId?: string;
  };
  affectedAuthority: AuthorityRef[];
  correctionClass:
    | "authority_error"
    | "missing_context"
    | "participation_error"
    | "priority_error"
    | "source_gap"
    | "publication_quality_issue"
    | "audit_gap";
  evidence: EvidenceRef[];
  requiredResponse:
    | "factory_acknowledgement"
    | "factory_revision"
    | "governance_review"
    | "new_publication_package"
    | "no_action_required";
  severity: "low" | "medium" | "high" | "blocking";
  closureRequirements: string[];
  lifecycle: FeedbackPackageLifecycleState;
};

export type DisputeLifecycleState =
  | "raised"
  | "triaged"
  | "evidence_gathering"
  | "review_pending"
  | "escalated"
  | "resolved_upheld"
  | "resolved_rejected"
  | "resolved_amended"
  | "closed"
  | "preserved";

export type Dispute = {
  disputeId: string;
  targetAuthority: AuthorityRef;
  disputeClass:
    | "identity_conflict"
    | "chronology_conflict"
    | "participation_conflict"
    | "priority_conflict"
    | "source_conflict"
    | "publication_conflict"
    | "governance_process_conflict";
  evidenceBundle: EvidenceRef[];
  severity: "minor" | "material" | "high" | "blocking";
  resolutionPath: "standard_review" | "senior_review" | "library_review" | "factory_revision" | "audit_review";
  outcome?: "upheld" | "rejected" | "amended" | "merged" | "retired" | "returned_for_revision";
  lifecycle: DisputeLifecycleState;
};

export type AuditRecord = {
  auditRecordId: string;
  authorityRef: AuthorityRef;
  decisionRefs: string[];
  approvalRefs: string[];
  evidenceRefs: string[];
  packageRefs: string[];
  disputeRefs: string[];
  finalState: string;
  reconstruction: {
    actorChain: GovernanceActorRef[];
    stateTransitions: Array<{
      fromState: string;
      toState: string;
      changedBy: GovernanceActorRef;
      decisionId?: string;
      approvalId?: string;
      reason: string;
      changedAt?: string;
    }>;
  };
};
