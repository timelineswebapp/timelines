import { randomUUID } from "node:crypto";
import type {
  GovernanceActorRef,
  GovernanceQueue,
  PublicationPackage
} from "@/src/server/governance/contracts";
import { governanceRepository } from "@/src/server/repositories/governance-repository";
import { governanceService } from "@/src/server/services/governance-service";

const POLL_LIMIT = 25;
const GOVERNANCE_ACTOR: GovernanceActorRef = {
  actorId: "governance-decision-engine",
  role: "governance_reviewer",
  institutionId: "governance"
};

export type GovernancePolicyResult =
  | { outcome: "routine"; reasons: string[] }
  | { outcome: "exceptional"; reasons: string[] };

export function evaluateGovernancePolicy(publicationPackage: PublicationPackage): GovernancePolicyResult {
  const reasons: string[] = [];
  const validatedEvidence = publicationPackage.validationArtifacts.filter(
    (artifact) =>
      artifact.evidenceType === "validated_evidence" &&
      artifact.authoritySafe &&
      Boolean(artifact.evidenceRecordId) &&
      Boolean(artifact.validationRecordId)
  );

  if (publicationPackage.includedAuthority.length === 0) reasons.push("Publication package contains no authority.");
  if (validatedEvidence.length < 2) reasons.push("Publication package has fewer than two validated evidence records.");
  if (publicationPackage.riskSummary.unresolvedAuthorityRisks.length > 0) reasons.push("Unresolved authority risks remain.");
  if (publicationPackage.riskSummary.disputeRefs.length > 0) reasons.push("Open evidence disputes remain.");
  if (publicationPackage.riskSummary.validationWarnings.length > 0) reasons.push("Validation warnings require Governance review.");
  if (publicationPackage.riskSummary.publicationBlockers.length > 0) reasons.push("Publication blockers remain.");

  return reasons.length === 0
    ? { outcome: "routine", reasons: ["Package is complete, authority-safe, validated, and has no unresolved risks."] }
    : { outcome: "exceptional", reasons };
}

export const governanceExecutionService = {
  async runCycle() {
    const packages = await governanceRepository.listPublicationPackages(POLL_LIMIT);
    const pending = packages.filter((publicationPackage) => publicationPackage.lifecycle === "governance_review");
    const results = [];

    for (const publicationPackage of pending) {
      try {
        results.push(await processPackage(publicationPackage));
      } catch (error) {
        results.push({
          packageId: publicationPackage.packageId,
          status: "failed" as const,
          error: error instanceof Error ? error.message : "Unknown Governance execution failure."
        });
      }
    }

    return {
      polled: packages.length,
      pending: pending.length,
      processed: results.filter((result) => result.status !== "failed").length,
      failed: results.filter((result) => result.status === "failed").length,
      results
    };
  }
};

async function processPackage(publicationPackage: PublicationPackage) {
  const policy = evaluateGovernancePolicy(publicationPackage);
  if (policy.outcome === "exceptional") {
    const queues = await governanceRepository.listQueues(POLL_LIMIT * 4);
    const existing = queues.find(
      (queue) =>
        queue.queueType === "publication_readiness" &&
        queue.targetAuthority.authorityType === "publication_package" &&
        queue.targetAuthority.authorityId === publicationPackage.packageId &&
        queue.lifecycle !== "exited" &&
        queue.lifecycle !== "preserved"
    );
    if (!existing) {
      await governanceService.createQueue(buildHumanQueue(publicationPackage));
    }
    return { packageId: publicationPackage.packageId, status: "awaiting_human_review" as const, policy };
  }

  if (publicationPackage.decisionRefs.length > 0) {
    return { packageId: publicationPackage.packageId, status: "already_decided" as const, policy };
  }

  const targetAuthority = {
    authorityType: "publication_package" as const,
    authorityId: publicationPackage.packageId
  };
  const reason = policy.reasons.join(" ");
  const evidenceRefs = publicationPackage.validationArtifacts.filter((artifact) => artifact.evidenceType === "validated_evidence");
  const readinessDecisionId = await createApprovedDecision({
    decisionType: "CERTIFY_PUBLICATION_READINESS",
    targetAuthority,
    evidenceRefs,
    summary: "Autonomous Governance review certified a routine publication package.",
    policy,
    reason
  });
  await governanceService.certifyReadiness({
    id: publicationPackage.packageId,
    governanceDecisionId: readinessDecisionId,
    actor: GOVERNANCE_ACTOR,
    reason
  });
  await governanceService.submitPackageToLibraryReview({
    id: publicationPackage.packageId,
    actor: GOVERNANCE_ACTOR,
    reason: "Governance readiness certification completed."
  });
  const acceptanceDecisionId = await createApprovedDecision({
    decisionType: "ACCEPT_PUBLICATION_PACKAGE",
    targetAuthority,
    evidenceRefs,
    summary: "Autonomous Governance review accepted a routine publication package for Historical Library admission.",
    policy,
    reason
  });
  await governanceService.acceptPackage({
    id: publicationPackage.packageId,
    governanceDecisionId: acceptanceDecisionId,
    actor: GOVERNANCE_ACTOR,
    reason: "Approved Governance decision authorizes Historical Library acceptance."
  });

  return {
    packageId: publicationPackage.packageId,
    status: "accepted" as const,
    policy,
    readinessDecisionId,
    acceptanceDecisionId
  };
}

async function createApprovedDecision(input: {
  decisionType: "CERTIFY_PUBLICATION_READINESS" | "ACCEPT_PUBLICATION_PACKAGE";
  targetAuthority: { authorityType: "publication_package"; authorityId: string };
  evidenceRefs: PublicationPackage["validationArtifacts"];
  summary: string;
  policy: Extract<GovernancePolicyResult, { outcome: "routine" }>;
  reason: string;
}): Promise<string> {
  const decisionId = randomUUID();
  const approvalId = randomUUID();
  const stepId = randomUUID();
  await governanceService.createDecision({
    decisionId,
    decisionType: input.decisionType,
    targetAuthority: input.targetAuthority,
    actor: GOVERNANCE_ACTOR,
    evidenceRefs: input.evidenceRefs,
    rationale: { summary: input.summary, authorityBasis: input.policy.reasons },
    approvalRefs: [],
    escalationRefs: [],
    outcome: "no_action",
    lifecycle: "draft"
  });
  await governanceService.submitDecision({ id: decisionId, actor: GOVERNANCE_ACTOR, reason: input.reason });
  await governanceService.reviewDecision({ id: decisionId, actor: GOVERNANCE_ACTOR, reason: input.reason });
  await governanceService.createApproval({
    approvalId,
    decisionId,
    request: {
      requestedBy: GOVERNANCE_ACTOR,
      requestedRole: "governance_reviewer",
      targetAuthority: input.targetAuthority,
      reason: input.reason
    },
    steps: [{ stepId, sequence: 1, requiredRole: "governance_reviewer" }],
    lifecycle: "pending"
  });
  await governanceService.approveStep({ id: approvalId, stepId, actor: GOVERNANCE_ACTOR, reason: input.reason });
  await governanceService.approveDecision({ id: decisionId, actor: GOVERNANCE_ACTOR, reason: input.reason });
  return decisionId;
}

function buildHumanQueue(publicationPackage: PublicationPackage): GovernanceQueue {
  return {
    queueId: randomUUID(),
    queueType: "publication_readiness",
    ownerService: "governance",
    ownerRole: "governance_reviewer",
    targetAuthority: {
      authorityType: "publication_package",
      authorityId: publicationPackage.packageId
    },
    allowedActions: ["approve", "reject", "request_revision", "escalate", "certify_ready"],
    decisionRefs: [],
    auditRefs: [],
    lifecycle: "entered"
  };
}
