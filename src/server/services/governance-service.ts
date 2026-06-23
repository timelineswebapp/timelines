import { ApiError } from "@/src/server/api/responses";
import type {
  Approval,
  AuditRecord,
  Dispute,
  FeedbackPackage,
  GovernanceDecision,
  GovernanceQueue,
  PublicationPackage
} from "@/src/server/governance/contracts";
import {
  approvalTransitions,
  assertLifecycleTransition,
  disputeTransitions,
  feedbackPackageTransitions,
  governanceDecisionTransitions,
  governanceQueueTransitions,
  publicationPackageTransitions
} from "@/src/server/governance/lifecycle";
import { assertFactoryCannotPublish, assertPlatformReadOnly, assertServiceMayPerformAction } from "@/src/server/governance/service-boundaries";
import {
  governanceRepository,
  verifyApprovedGovernanceDecision,
  verifyValidatedEvidenceRefs
} from "@/src/server/repositories/governance-repository";

type TransitionActor = AuditRecord["reconstruction"]["actorChain"][number];
type TransitionInput = {
  id: string;
  actor: TransitionActor;
  reason: string;
  governanceDecisionId?: string;
};

function assertEvidenceAuthoritySafe(evidenceRefs: Array<{ authoritySafe: boolean }>, context: string): void {
  if (evidenceRefs.some((evidence) => !evidence.authoritySafe)) {
    throw new ApiError(409, "UNSAFE_GOVERNANCE_EVIDENCE", `${context} contains evidence that is not authority-safe.`);
  }
}

function assertDecisionCanMutateAuthority(input: GovernanceDecision): void {
  if (input.lifecycle === "approved" || input.lifecycle === "rejected" || input.lifecycle === "superseded" || input.lifecycle === "preserved") {
    throw new ApiError(409, "INVALID_GOVERNANCE_DECISION_INITIAL_STATE", "GovernanceDecision cannot be created directly in a terminal or decided state.");
  }
  if (input.outcome === "approved" || input.outcome === "rejected" || input.outcome === "superseded") {
    throw new ApiError(409, "INVALID_GOVERNANCE_DECISION_INITIAL_OUTCOME", "GovernanceDecision cannot be created directly with a final outcome.");
  }
}

function assertInitialLifecycle<T extends string>(value: T, allowed: readonly T[], context: string): void {
  if (!allowed.includes(value)) {
    throw new ApiError(409, "INVALID_GOVERNANCE_INITIAL_LIFECYCLE", `${context} cannot be created directly in ${value}.`);
  }
}

function decisionRequiresValidatedEvidence(decisionType: GovernanceDecision["decisionType"]): boolean {
  return [
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
    "ACCEPT_PUBLICATION_PACKAGE"
  ].includes(decisionType);
}

export const governanceService = {
  async createDecision(input: GovernanceDecision) {
    assertPlatformReadOnly("governance");
    assertEvidenceAuthoritySafe(input.evidenceRefs, "GovernanceDecision");
    assertDecisionCanMutateAuthority(input);
    if (decisionRequiresValidatedEvidence(input.decisionType)) {
      await verifyValidatedEvidenceRefs(input.evidenceRefs, "GovernanceDecision");
    }
    return governanceRepository.createDecision(input);
  },

  createApproval(input: Approval) {
    if (input.steps.length === 0) {
      throw new ApiError(400, "APPROVAL_STEPS_REQUIRED", "Approval requires at least one step.");
    }
    assertInitialLifecycle(input.lifecycle, ["requested", "pending"], "Approval");
    return governanceRepository.createApproval(input);
  },

  createQueue(input: GovernanceQueue) {
    assertInitialLifecycle(input.lifecycle, ["entered"], "GovernanceQueue");
    for (const action of input.allowedActions) {
      assertServiceMayPerformAction(input.ownerService, action);
      assertFactoryCannotPublish(input.ownerService, action);
    }
    return governanceRepository.createQueue(input);
  },

  async createPublicationPackage(input: PublicationPackage) {
    assertInitialLifecycle(input.lifecycle, ["factory_draft", "factory_validating", "factory_ready"], "PublicationPackage");
    assertEvidenceAuthoritySafe(input.validationArtifacts, "PublicationPackage");
    await verifyValidatedEvidenceRefs(input.validationArtifacts, "PublicationPackage");
    if (input.readinessCertification || input.acceptanceOutcome) {
      throw new ApiError(409, "PUBLICATION_CHAIN_BYPASS_BLOCKED", "PublicationPackage cannot be created with readiness certification or library acceptance.");
    }
    return governanceRepository.createPublicationPackage(input);
  },

  createFeedbackPackage(input: FeedbackPackage) {
    assertInitialLifecycle(input.lifecycle, ["created"], "FeedbackPackage");
    assertEvidenceAuthoritySafe(input.evidence, "FeedbackPackage");
    return governanceRepository.createFeedbackPackage(input);
  },

  createDispute(input: Dispute) {
    assertInitialLifecycle(input.lifecycle, ["raised"], "Dispute");
    assertEvidenceAuthoritySafe(input.evidenceBundle, "Dispute");
    if (input.outcome) {
      throw new ApiError(409, "DISPUTE_DECISION_REQUIRED", "Dispute outcomes require a GovernanceDecision resolution path and cannot be created directly.");
    }
    return governanceRepository.createDispute(input);
  },

  createAuditRecord(input: AuditRecord) {
    if (input.decisionRefs.length === 0) {
      throw new ApiError(409, "AUDIT_DECISION_REFERENCE_REQUIRED", "Audit reconstruction requires at least one GovernanceDecision reference.");
    }
    if (input.reconstruction.stateTransitions.length === 0) {
      throw new ApiError(409, "AUDIT_TRANSITION_REQUIRED", "Audit reconstruction requires at least one state transition.");
    }
    return governanceRepository.createAuditRecord(input);
  },

  async submitDecision(input: TransitionInput) {
    const decision = await loadDecision(input.id);
    assertLifecycleTransition("GovernanceDecision", governanceDecisionTransitions, decision.lifecycle, "submitted");
    const updated = await governanceRepository.transitionDecision(input.id, "submitted", null);
    await auditTransition({
      authorityRef: decision.targetAuthority,
      fromState: decision.lifecycle,
      toState: updated.lifecycle,
      actor: input.actor,
      reason: input.reason,
      decisionRefs: [input.id]
    });
    return updated;
  },

  async reviewDecision(input: TransitionInput) {
    const decision = await loadDecision(input.id);
    assertLifecycleTransition("GovernanceDecision", governanceDecisionTransitions, decision.lifecycle, "under_review");
    const updated = await governanceRepository.transitionDecision(input.id, "under_review", null);
    await auditTransition({
      authorityRef: decision.targetAuthority,
      fromState: decision.lifecycle,
      toState: updated.lifecycle,
      actor: input.actor,
      reason: input.reason,
      decisionRefs: [input.id]
    });
    return updated;
  },

  async approveDecision(input: TransitionInput) {
    const decision = await loadDecision(input.id);
    const hasApprovalChain = await governanceRepository.hasApprovedApprovalChain(input.id);
    if (!hasApprovalChain) {
      throw new ApiError(409, "APPROVAL_CHAIN_REQUIRED", "Approving a GovernanceDecision requires an approved approval chain.");
    }
    assertLifecycleTransition("GovernanceDecision", governanceDecisionTransitions, decision.lifecycle, "approved");
    if (decisionRequiresValidatedEvidence(decision.decisionType)) {
      await verifyValidatedEvidenceRefs(decision.evidenceRefs, "GovernanceDecision approval");
    }
    const updated = await governanceRepository.transitionDecision(input.id, "approved", "approved");
    await auditTransition({
      authorityRef: decision.targetAuthority,
      fromState: decision.lifecycle,
      toState: updated.lifecycle,
      actor: input.actor,
      reason: input.reason,
      decisionRefs: [input.id]
    });
    return updated;
  },

  async rejectDecision(input: TransitionInput) {
    const decision = await loadDecision(input.id);
    assertLifecycleTransition("GovernanceDecision", governanceDecisionTransitions, decision.lifecycle, "rejected");
    const updated = await governanceRepository.transitionDecision(input.id, "rejected", "rejected");
    await auditTransition({
      authorityRef: decision.targetAuthority,
      fromState: decision.lifecycle,
      toState: updated.lifecycle,
      actor: input.actor,
      reason: input.reason,
      decisionRefs: [input.id]
    });
    return updated;
  },

  async escalateDecision(input: TransitionInput) {
    const decision = await loadDecision(input.id);
    assertLifecycleTransition("GovernanceDecision", governanceDecisionTransitions, decision.lifecycle, "escalated");
    const updated = await governanceRepository.transitionDecision(input.id, "escalated", "escalated");
    await auditTransition({
      authorityRef: decision.targetAuthority,
      fromState: decision.lifecycle,
      toState: updated.lifecycle,
      actor: input.actor,
      reason: input.reason,
      decisionRefs: [input.id]
    });
    return updated;
  },

  async supersedeDecision(input: TransitionInput) {
    const decision = await loadDecision(input.id);
    assertLifecycleTransition("GovernanceDecision", governanceDecisionTransitions, decision.lifecycle, "superseded");
    const updated = await governanceRepository.transitionDecision(input.id, "superseded", "superseded");
    await auditTransition({
      authorityRef: decision.targetAuthority,
      fromState: decision.lifecycle,
      toState: updated.lifecycle,
      actor: input.actor,
      reason: input.reason,
      decisionRefs: [input.id]
    });
    return updated;
  },

  async requestApproval(input: TransitionInput) {
    return transitionApprovalLifecycle(input, "pending");
  },

  async approveStep(input: TransitionInput & { stepId: string }) {
    const approval = await loadApproval(input.id);
    const step = approval.steps.find((candidate) => candidate.stepId === input.stepId);
    if (!step) {
      throw new ApiError(404, "APPROVAL_STEP_NOT_FOUND", "Approval step not found.");
    }
    step.approver = input.actor;
    step.outcome = "approved";
    step.reason = input.reason;
    const nextLifecycle = approval.steps.every((candidate) => candidate.outcome === "approved") ? "approved" : "partially_approved";
    assertLifecycleTransition("Approval", approvalTransitions, approval.lifecycle, nextLifecycle);
    const updated = await governanceRepository.transitionApproval({ ...approval, lifecycle: nextLifecycle, steps: approval.steps });
    await auditTransition({
      authorityRef: approval.request.targetAuthority,
      fromState: approval.lifecycle,
      toState: updated.lifecycle,
      actor: input.actor,
      reason: input.reason,
      approvalRefs: [input.id],
      decisionRefs: [approval.decisionId]
    });
    return updated;
  },

  async rejectStep(input: TransitionInput & { stepId: string }) {
    const approval = await loadApproval(input.id);
    const step = approval.steps.find((candidate) => candidate.stepId === input.stepId);
    if (!step) {
      throw new ApiError(404, "APPROVAL_STEP_NOT_FOUND", "Approval step not found.");
    }
    step.approver = input.actor;
    step.outcome = "rejected";
    step.reason = input.reason;
    assertLifecycleTransition("Approval", approvalTransitions, approval.lifecycle, "rejected");
    const updated = await governanceRepository.transitionApproval({ ...approval, lifecycle: "rejected", steps: approval.steps });
    await auditTransition({
      authorityRef: approval.request.targetAuthority,
      fromState: approval.lifecycle,
      toState: updated.lifecycle,
      actor: input.actor,
      reason: input.reason,
      approvalRefs: [input.id],
      decisionRefs: [approval.decisionId]
    });
    return updated;
  },

  async escalateApproval(input: TransitionInput) {
    return transitionApprovalLifecycle(input, "escalated");
  },

  async completeApprovalChain(input: TransitionInput) {
    const approval = await loadApproval(input.id);
    if (!approval.steps.every((step) => step.outcome === "approved")) {
      throw new ApiError(409, "APPROVAL_CHAIN_INCOMPLETE", "All approval steps must be approved before completion.");
    }
    assertLifecycleTransition("Approval", approvalTransitions, approval.lifecycle, "approved");
    const updated = await governanceRepository.transitionApproval({ ...approval, lifecycle: "approved" });
    await auditTransition({
      authorityRef: approval.request.targetAuthority,
      fromState: approval.lifecycle,
      toState: updated.lifecycle,
      actor: input.actor,
      reason: input.reason,
      approvalRefs: [input.id],
      decisionRefs: [approval.decisionId]
    });
    return updated;
  },

  async enterQueue(input: TransitionInput) {
    return transitionQueueLifecycle(input, "in_review");
  },

  async advanceQueue(input: TransitionInput) {
    return transitionQueueLifecycle(input, "in_review");
  },

  async exitQueue(input: TransitionInput) {
    return transitionQueueLifecycle(input, "exited");
  },

  async escalateQueue(input: TransitionInput) {
    return transitionQueueLifecycle(input, "blocked");
  },

  async submitPackage(input: TransitionInput) {
    return transitionPublicationPackage(input, "governance_review");
  },

  async certifyReadiness(input: TransitionInput) {
    if (!input.governanceDecisionId) {
      throw new ApiError(409, "GOVERNANCE_DECISION_REQUIRED", "Readiness certification requires a GovernanceDecision.");
    }
    return transitionPublicationPackage(input, "readiness_certified");
  },

  async submitPackageToLibraryReview(input: TransitionInput) {
    return transitionPublicationPackage(input, "library_review");
  },

  async acceptPackage(input: TransitionInput) {
    if (!input.governanceDecisionId) {
      throw new ApiError(409, "GOVERNANCE_DECISION_REQUIRED", "Package acceptance requires a GovernanceDecision.");
    }
    return transitionPublicationPackage(input, "accepted");
  },

  async rejectPackage(input: TransitionInput) {
    return transitionPublicationPackage(input, "rejected");
  },

  async returnPackage(input: TransitionInput) {
    return transitionPublicationPackage(input, "returned_for_revision");
  },

  async publishPackage(input: TransitionInput) {
    return transitionPublicationPackage(input, "published");
  },

  async deliverFeedback(input: TransitionInput) {
    return transitionFeedbackPackage(input, "delivered_to_factory");
  },

  async acknowledgeFeedback(input: TransitionInput) {
    return transitionFeedbackPackage(input, "acknowledged");
  },

  async resolveFeedback(input: TransitionInput) {
    return transitionFeedbackPackage(input, "resolved");
  },

  async closeFeedback(input: TransitionInput) {
    return transitionFeedbackPackage(input, "closed");
  },

  async triageDispute(input: TransitionInput) {
    return transitionDispute(input, "triaged");
  },

  async escalateDispute(input: TransitionInput) {
    return transitionDispute(input, "escalated");
  },

  async resolveDispute(input: TransitionInput & { outcome: NonNullable<Dispute["outcome"]> }) {
    if (!input.governanceDecisionId) {
      throw new ApiError(409, "GOVERNANCE_DECISION_REQUIRED", "Dispute resolution requires a GovernanceDecision.");
    }
    const lifecycle =
      input.outcome === "rejected"
        ? "resolved_rejected"
        : input.outcome === "amended"
          ? "resolved_amended"
          : "resolved_upheld";
    return transitionDispute(input, lifecycle, input.outcome);
  },

  async closeDispute(input: TransitionInput) {
    return transitionDispute(input, "closed");
  }
};

async function loadDecision(decisionId: string): Promise<GovernanceDecision> {
  const decision = await governanceRepository.getDecision(decisionId);
  if (!decision) {
    throw new ApiError(404, "GOVERNANCE_DECISION_NOT_FOUND", "GovernanceDecision not found.");
  }
  return decision;
}

async function loadApproval(approvalId: string): Promise<Approval> {
  const approval = await governanceRepository.getApproval(approvalId);
  if (!approval) {
    throw new ApiError(404, "APPROVAL_NOT_FOUND", "Approval not found.");
  }
  return approval;
}

async function transitionApprovalLifecycle(input: TransitionInput, lifecycle: Approval["lifecycle"]): Promise<Approval> {
  const approval = await loadApproval(input.id);
  assertLifecycleTransition("Approval", approvalTransitions, approval.lifecycle, lifecycle);
  const updated = await governanceRepository.transitionApproval({ ...approval, lifecycle });
  await auditTransition({
    authorityRef: approval.request.targetAuthority,
    fromState: approval.lifecycle,
    toState: updated.lifecycle,
    actor: input.actor,
    reason: input.reason,
    approvalRefs: [input.id],
    decisionRefs: [approval.decisionId]
  });
  return updated;
}

async function transitionQueueLifecycle(input: TransitionInput, lifecycle: GovernanceQueue["lifecycle"]): Promise<GovernanceQueue> {
  const queue = await governanceRepository.getQueue(input.id);
  if (!queue) {
    throw new ApiError(404, "GOVERNANCE_QUEUE_NOT_FOUND", "GovernanceQueue not found.");
  }
  assertLifecycleTransition("GovernanceQueue", governanceQueueTransitions, queue.lifecycle, lifecycle);
  const updated = await governanceRepository.transitionQueue(input.id, lifecycle);
  await auditTransition({
    authorityRef: queue.targetAuthority,
    fromState: queue.lifecycle,
    toState: updated.lifecycle,
    actor: input.actor,
    reason: input.reason,
    decisionRefs: queue.decisionRefs
  });
  return updated;
}

async function transitionPublicationPackage(
  input: TransitionInput,
  lifecycle: PublicationPackage["lifecycle"]
): Promise<PublicationPackage> {
  const publicationPackage = await governanceRepository.getPublicationPackage(input.id);
  if (!publicationPackage) {
    throw new ApiError(404, "PUBLICATION_PACKAGE_NOT_FOUND", "PublicationPackage not found.");
  }
  assertLifecycleTransition("PublicationPackage", publicationPackageTransitions, publicationPackage.lifecycle, lifecycle);
  let next: PublicationPackage = { ...publicationPackage, lifecycle };
  const decisionRefs = [...publicationPackage.decisionRefs];
  if (input.governanceDecisionId) {
    const expectedDecisionTypes: GovernanceDecision["decisionType"][] =
      lifecycle === "readiness_certified"
        ? ["CERTIFY_PUBLICATION_READINESS"]
        : lifecycle === "accepted"
          ? ["ACCEPT_PUBLICATION_PACKAGE"]
          : lifecycle === "rejected"
            ? ["REJECT_PUBLICATION_PACKAGE"]
            : lifecycle === "returned_for_revision"
              ? ["RETURN_PUBLICATION_PACKAGE"]
              : [];
    if (expectedDecisionTypes.length > 0) {
      const decision = await verifyApprovedGovernanceDecision({
        governanceDecisionId: input.governanceDecisionId,
        expectedDecisionTypes,
        expectedAuthorityType: "publication_package",
        expectedAuthorityId: input.id
      });
      if (lifecycle === "readiness_certified" || lifecycle === "accepted") {
        await verifyValidatedEvidenceRefs(decision.evidenceRefs, "GovernanceDecision");
      }
      decisionRefs.push(decision.decisionId);
    }
  }
  if (lifecycle === "readiness_certified") {
    if (!input.governanceDecisionId) {
      throw new ApiError(409, "GOVERNANCE_DECISION_REQUIRED", "Readiness certification requires a GovernanceDecision.");
    }
    await verifyValidatedEvidenceRefs(publicationPackage.validationArtifacts, "PublicationPackage readiness certification");
    next = {
      ...next,
      decisionRefs,
      readinessCertification: {
        certifiedBy: input.actor,
        decisionId: input.governanceDecisionId,
        readinessStatus: "ready"
      }
    };
  } else if (lifecycle === "accepted") {
    if (!publicationPackage.readinessCertification) {
      throw new ApiError(409, "READINESS_CERTIFICATION_REQUIRED", "Package acceptance requires readiness certification.");
    }
    await verifyValidatedEvidenceRefs(publicationPackage.validationArtifacts, "PublicationPackage acceptance");
    next = { ...next, decisionRefs, acceptanceOutcome: "accepted" };
  } else if (lifecycle === "rejected") {
    next = { ...next, decisionRefs, acceptanceOutcome: "rejected" };
  } else if (lifecycle === "returned_for_revision") {
    next = { ...next, decisionRefs, acceptanceOutcome: "returned_for_revision" };
  }
  const updated = await governanceRepository.transitionPublicationPackage(next);
  await auditTransition({
    authorityRef: { authorityType: "publication_package", authorityId: input.id },
    fromState: publicationPackage.lifecycle,
    toState: updated.lifecycle,
    actor: input.actor,
    reason: input.reason,
    decisionRefs,
    packageRefs: [input.id]
  });
  return updated;
}

async function transitionFeedbackPackage(
  input: TransitionInput,
  lifecycle: FeedbackPackage["lifecycle"]
): Promise<FeedbackPackage> {
  const feedbackPackage = await governanceRepository.getFeedbackPackage(input.id);
  if (!feedbackPackage) {
    throw new ApiError(404, "FEEDBACK_PACKAGE_NOT_FOUND", "FeedbackPackage not found.");
  }
  assertLifecycleTransition("FeedbackPackage", feedbackPackageTransitions, feedbackPackage.lifecycle, lifecycle);
  const updated = await governanceRepository.transitionFeedbackPackage(input.id, lifecycle);
  await auditTransition({
    authorityRef: { authorityType: "feedback_package", authorityId: input.id },
    fromState: feedbackPackage.lifecycle,
    toState: updated.lifecycle,
    actor: input.actor,
    reason: input.reason,
    packageRefs: [input.id]
  });
  return updated;
}

async function transitionDispute(
  input: TransitionInput,
  lifecycle: Dispute["lifecycle"],
  outcome?: Dispute["outcome"]
): Promise<Dispute> {
  const dispute = await governanceRepository.getDispute(input.id);
  if (!dispute) {
    throw new ApiError(404, "DISPUTE_NOT_FOUND", "Dispute not found.");
  }
  assertLifecycleTransition("Dispute", disputeTransitions, dispute.lifecycle, lifecycle);
  const decisionRefs: string[] = [];
  if (outcome) {
    if (!input.governanceDecisionId) {
      throw new ApiError(409, "GOVERNANCE_DECISION_REQUIRED", "Dispute resolution requires a GovernanceDecision.");
    }
    const decision = await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["RESOLVE_DISPUTE"],
      expectedAuthorityType: "dispute",
      expectedAuthorityId: input.id
    });
    decisionRefs.push(decision.decisionId);
  }
  const updated = await governanceRepository.transitionDispute({ ...dispute, lifecycle, outcome });
  await auditTransition({
    authorityRef: { authorityType: "dispute", authorityId: input.id },
    fromState: dispute.lifecycle,
    toState: updated.lifecycle,
    actor: input.actor,
    reason: input.reason,
    decisionRefs,
    disputeRefs: [input.id]
  });
  return updated;
}

async function auditTransition(input: Parameters<typeof governanceRepository.createTransitionAudit>[0]): Promise<AuditRecord> {
  return governanceRepository.createTransitionAudit(input);
}
