import { ApiError } from "@/src/server/api/responses";
import type {
  ApprovalLifecycleState,
  DisputeLifecycleState,
  FeedbackPackageLifecycleState,
  GovernanceDecisionLifecycleState,
  GovernanceQueue,
  PublicationPackageLifecycleState
} from "@/src/server/governance/contracts";

type TransitionMap<T extends string> = Record<T, readonly T[]>;

export const governanceDecisionTransitions: TransitionMap<GovernanceDecisionLifecycleState> = {
  draft: ["submitted"],
  submitted: ["under_review", "returned_for_revision", "rejected"],
  under_review: ["approval_pending", "approved", "rejected", "returned_for_revision", "escalated"],
  approval_pending: ["approved", "rejected", "returned_for_revision", "escalated"],
  approved: ["superseded", "preserved"],
  rejected: ["preserved"],
  returned_for_revision: ["submitted", "preserved"],
  escalated: ["under_review", "approved", "rejected", "preserved"],
  superseded: ["preserved"],
  preserved: []
};

export const approvalTransitions: TransitionMap<ApprovalLifecycleState> = {
  requested: ["pending", "expired"],
  pending: ["partially_approved", "approved", "rejected", "returned_for_revision", "escalated", "expired"],
  partially_approved: ["approved", "rejected", "returned_for_revision", "escalated", "expired"],
  approved: ["preserved"],
  rejected: ["preserved"],
  returned_for_revision: ["pending", "preserved"],
  escalated: ["pending", "approved", "rejected", "preserved"],
  expired: ["preserved"],
  preserved: []
};

export const publicationPackageTransitions: TransitionMap<PublicationPackageLifecycleState> = {
  factory_draft: ["factory_validating"],
  factory_validating: ["factory_ready", "factory_draft"],
  factory_ready: ["governance_review"],
  governance_review: ["readiness_certified", "returned_for_revision", "rejected"],
  readiness_certified: ["library_review"],
  library_review: ["accepted", "rejected", "returned_for_revision"],
  accepted: ["published", "preserved"],
  rejected: ["preserved"],
  returned_for_revision: ["factory_draft", "preserved"],
  published: ["preserved"],
  preserved: []
};

export const feedbackPackageTransitions: TransitionMap<FeedbackPackageLifecycleState> = {
  created: ["delivered_to_factory"],
  delivered_to_factory: ["acknowledged"],
  acknowledged: ["factory_reviewing", "informational"],
  factory_reviewing: ["action_required", "resolved"],
  action_required: ["factory_reviewing", "resolved"],
  informational: ["closed"],
  resolved: ["closed"],
  closed: ["preserved"],
  preserved: []
};

export const disputeTransitions: TransitionMap<DisputeLifecycleState> = {
  raised: ["triaged"],
  triaged: ["evidence_gathering", "review_pending", "escalated"],
  evidence_gathering: ["review_pending", "escalated"],
  review_pending: ["resolved_upheld", "resolved_rejected", "resolved_amended", "escalated"],
  escalated: ["review_pending", "resolved_upheld", "resolved_rejected", "resolved_amended"],
  resolved_upheld: ["closed"],
  resolved_rejected: ["closed"],
  resolved_amended: ["closed"],
  closed: ["preserved"],
  preserved: []
};

export const governanceQueueTransitions: TransitionMap<GovernanceQueue["lifecycle"]> = {
  entered: ["in_review", "blocked", "exited"],
  in_review: ["blocked", "exited"],
  blocked: ["in_review", "exited"],
  exited: ["preserved"],
  preserved: []
};

export function assertLifecycleTransition<T extends string>(
  name: string,
  transitions: TransitionMap<T>,
  from: T,
  to: T
): void {
  if (!transitions[from]?.includes(to)) {
    throw new ApiError(409, "INVALID_GOVERNANCE_LIFECYCLE_TRANSITION", `${name} cannot transition from ${from} to ${to}.`);
  }
}

export function assertGovernanceDecisionRequired(governanceDecisionId: string | undefined, operation: string): void {
  if (!governanceDecisionId) {
    throw new ApiError(
      409,
      "GOVERNANCE_DECISION_REQUIRED",
      `${operation} requires an approved GovernanceDecision before authority can mutate.`
    );
  }
}
