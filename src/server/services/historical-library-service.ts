import { randomUUID } from "node:crypto";
import { ApiError } from "@/src/server/api/responses";
import type {
  AuthorityRef,
  EvidenceRef,
  FeedbackPackage,
  GovernanceActorRef,
  GovernanceDecisionType,
  GovernanceServiceBoundary
} from "@/src/server/governance/contracts";
import { assertPlatformReadOnly } from "@/src/server/governance/service-boundaries";
import {
  governanceRepository,
  verifyApprovedGovernanceDecision,
  verifyValidatedEvidenceRefs
} from "@/src/server/repositories/governance-repository";
import { historicalLibraryRepository } from "@/src/server/repositories/historical-library-repository";
import { governanceService } from "@/src/server/services/governance-service";
import { publishedMemoryProjectionService } from "@/src/server/services/published-memory-projection-service";

export type AdmitPublicationPackageInput = {
  packageId: string;
  governanceDecisionId: string;
  actor: GovernanceActorRef;
  reason: string;
  requestedByService?: GovernanceServiceBoundary;
  auditRefs?: string[];
};

type LibraryLifecycleInput = {
  publishedSnapshotId: string;
  publicationPackageId: string;
  governanceDecisionId: string;
  actor: GovernanceActorRef;
  reason: string;
  auditRecordId?: string | null;
};

export type RevisePublishedMemoryInput = LibraryLifecycleInput & {
  revisedSnapshot: Record<string, unknown>;
  amendmentSummary: string;
};

export type RetirePublishedMemoryInput = LibraryLifecycleInput & {
  continuityPath: Record<string, unknown>;
};

export type MergePublishedMemoryInput = Omit<LibraryLifecycleInput, "publishedSnapshotId"> & {
  sourcePublishedRecordId: string;
  targetPublishedRecordId: string;
  continuityPath: Record<string, unknown>;
};

export type PreservePublishedMemoryInput = LibraryLifecycleInput & {
  preservationMetadata: Record<string, unknown>;
};

export type GenerateHistoricalLibraryFeedbackInput = {
  lifecycleActionType: "revision" | "retirement" | "merge" | "preservation";
  lifecycleActionId: string;
  publicationPackageId: string;
  sourcePublishedRecordId: string;
  targetPublishedRecordId?: string | null;
  governanceDecisionId: string;
  actor: GovernanceActorRef;
  affectedAuthority: AuthorityRef[];
  correctionClass: FeedbackPackage["correctionClass"];
  evidence: EvidenceRef[];
  requiredResponse: FeedbackPackage["requiredResponse"];
  severity: FeedbackPackage["severity"];
  closureRequirements: string[];
  reason: string;
};

function assertHistoricalLibraryAdmissionService(service: GovernanceServiceBoundary): void {
  assertPlatformReadOnly(service);

  if (service === "factory") {
    throw new ApiError(403, "FACTORY_LIBRARY_ADMISSION_BYPASS_BLOCKED", "Factory cannot admit PublicationPackages into Published Memory.");
  }

  if (service !== "historical_library") {
    throw new ApiError(403, "HISTORICAL_LIBRARY_SERVICE_REQUIRED", "Published Memory admission must be performed by Historical Library.");
  }
}

function assertLibraryActor(actor: GovernanceActorRef): void {
  if (actor.role !== "library_editor") {
    throw new ApiError(403, "HISTORICAL_LIBRARY_ACTOR_REQUIRED", "Historical Library lifecycle actions require a library_editor actor.");
  }
}

function extractSnapshotPackageId(snapshot: Record<string, unknown>): string | null {
  const packageId = snapshot.publicationPackageId;
  return typeof packageId === "string" ? packageId : null;
}

async function loadLifecycleSnapshot(input: LibraryLifecycleInput) {
  assertLibraryActor(input.actor);
  const publishedSnapshot = await historicalLibraryRepository.getPublishedSnapshot(input.publishedSnapshotId);
  if (!publishedSnapshot) {
    throw new ApiError(404, "PUBLISHED_SNAPSHOT_NOT_FOUND", "Published Memory snapshot not found.");
  }
  const sourcePackageId = extractSnapshotPackageId(publishedSnapshot.snapshot);
  if (sourcePackageId !== input.publicationPackageId) {
    throw new ApiError(409, "PUBLISHED_SNAPSHOT_PACKAGE_MISMATCH", "Published Memory snapshot does not belong to the supplied PublicationPackage.");
  }
  return publishedSnapshot;
}

async function verifyLibraryDecision(input: {
  governanceDecisionId: string;
  expectedDecisionTypes: GovernanceDecisionType[];
  targetAuthority: AuthorityRef;
}) {
  return verifyApprovedGovernanceDecision({
    governanceDecisionId: input.governanceDecisionId,
    expectedDecisionTypes: input.expectedDecisionTypes,
    expectedAuthorityType: input.targetAuthority.authorityType,
    expectedAuthorityId: input.targetAuthority.authorityId
  });
}

export const historicalLibraryService = {
  async admitPublicationPackage(input: AdmitPublicationPackageInput) {
    const requestedByService = input.requestedByService || "historical_library";
    assertHistoricalLibraryAdmissionService(requestedByService);

    const publicationPackage = await governanceRepository.getPublicationPackage(input.packageId);
    if (!publicationPackage) {
      throw new ApiError(404, "PUBLICATION_PACKAGE_NOT_FOUND", "PublicationPackage not found.");
    }

    if (!publicationPackage.readinessCertification || publicationPackage.readinessCertification.readinessStatus !== "ready") {
      throw new ApiError(409, "PUBLICATION_PACKAGE_READINESS_REQUIRED", "PublicationPackage must have ready Governance certification before Library admission.");
    }

    if (publicationPackage.lifecycle !== "accepted" && publicationPackage.lifecycle !== "published") {
      throw new ApiError(409, "PUBLICATION_PACKAGE_NOT_ACCEPTED", "PublicationPackage must be accepted by Governance before Library admission.");
    }

    if (publicationPackage.acceptanceOutcome !== "accepted" && publicationPackage.acceptanceOutcome !== "accepted_with_notes") {
      throw new ApiError(409, "PUBLICATION_PACKAGE_ACCEPTANCE_REQUIRED", "PublicationPackage requires an accepted Library outcome before admission.");
    }

    if (publicationPackage.riskSummary.publicationBlockers.length > 0) {
      throw new ApiError(409, "PUBLICATION_PACKAGE_BLOCKED", "PublicationPackage has unresolved publication blockers.");
    }
    await verifyValidatedEvidenceRefs(publicationPackage.validationArtifacts, "Historical Library admission");

    const existingAdmission = await historicalLibraryRepository.getAdmissionByPackageId(input.packageId);
    if (existingAdmission) {
      return {
        admission: existingAdmission,
        snapshots: await historicalLibraryRepository.getPublishedSnapshotsByAdmissionId(existingAdmission.admissionId)
      };
    }

    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["ACCEPT_PUBLICATION_PACKAGE"],
      expectedAuthorityType: "publication_package",
      expectedAuthorityId: input.packageId
    });

    const admissionResult = await historicalLibraryRepository.createAdmission({
      publicationPackage,
      governanceDecisionId: input.governanceDecisionId,
      admittedBy: input.actor,
      admissionReason: input.reason,
      auditRefs: input.auditRefs
    });
    await publishedMemoryProjectionService.generateForAdmission({
      admissionId: admissionResult.admission.admissionId,
      snapshots: admissionResult.snapshots,
      auditRecordId: input.auditRefs?.[0] || null
    });
    return admissionResult;
  },

  async revisePublishedMemory(input: RevisePublishedMemoryInput) {
    const publishedSnapshot = await loadLifecycleSnapshot(input);
    await verifyLibraryDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["REVISE_HISTORICAL_OBJECT", "REVISE_PARTICIPATION", "REVISE_RELATIONSHIP"],
      targetAuthority: publishedSnapshot.authorityRef
    });
    const revision = await historicalLibraryRepository.createRevision({
      publishedSnapshot,
      publicationPackageId: input.publicationPackageId,
      governanceDecisionId: input.governanceDecisionId,
      revisedSnapshot: input.revisedSnapshot,
      amendmentSummary: input.amendmentSummary,
      auditRecordId: input.auditRecordId,
      actor: input.actor
    });
    await publishedMemoryProjectionService.generateForRevision(revision);
    return revision;
  },

  async retirePublishedMemory(input: RetirePublishedMemoryInput) {
    const publishedSnapshot = await loadLifecycleSnapshot(input);
    await verifyLibraryDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["RETIRE_HISTORICAL_OBJECT", "RETIRE_PARTICIPATION", "RETIRE_RELATIONSHIP"],
      targetAuthority: publishedSnapshot.authorityRef
    });
    const retirement = await historicalLibraryRepository.createRetirement({
      publishedSnapshot,
      publicationPackageId: input.publicationPackageId,
      governanceDecisionId: input.governanceDecisionId,
      retirementReason: input.reason,
      continuityPath: input.continuityPath,
      auditRecordId: input.auditRecordId,
      actor: input.actor
    });
    await publishedMemoryProjectionService.generateForRetirement(retirement);
    return retirement;
  },

  async mergePublishedMemory(input: MergePublishedMemoryInput) {
    assertLibraryActor(input.actor);
    if (input.sourcePublishedRecordId === input.targetPublishedRecordId) {
      throw new ApiError(409, "PUBLISHED_MEMORY_MERGE_SELF_REFERENCE", "Source and target Published Memory records must be distinct.");
    }
    const [sourceSnapshot, targetSnapshot] = await Promise.all([
      historicalLibraryRepository.getPublishedSnapshot(input.sourcePublishedRecordId),
      historicalLibraryRepository.getPublishedSnapshot(input.targetPublishedRecordId)
    ]);
    if (!sourceSnapshot || !targetSnapshot) {
      throw new ApiError(404, "PUBLISHED_SNAPSHOT_NOT_FOUND", "Source or target Published Memory snapshot not found.");
    }
    if (extractSnapshotPackageId(sourceSnapshot.snapshot) !== input.publicationPackageId) {
      throw new ApiError(409, "PUBLISHED_SNAPSHOT_PACKAGE_MISMATCH", "Source Published Memory snapshot does not belong to the supplied PublicationPackage.");
    }
    await verifyLibraryDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["MERGE_HISTORICAL_OBJECT", "MERGE_RELATIONSHIP"],
      targetAuthority: sourceSnapshot.authorityRef
    });
    const merge = await historicalLibraryRepository.createMerge({
      sourceSnapshot,
      targetSnapshot,
      publicationPackageId: input.publicationPackageId,
      governanceDecisionId: input.governanceDecisionId,
      mergeReason: input.reason,
      continuityPath: input.continuityPath,
      auditRecordId: input.auditRecordId,
      actor: input.actor
    });
    await publishedMemoryProjectionService.generateForMerge(merge);
    return merge;
  },

  async preservePublishedMemory(input: PreservePublishedMemoryInput) {
    const publishedSnapshot = await loadLifecycleSnapshot(input);
    await verifyLibraryDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["PRESERVE_HISTORICAL_OBJECT", "PRESERVE_RELATIONSHIP"],
      targetAuthority: publishedSnapshot.authorityRef
    });
    const preservation = await historicalLibraryRepository.createPreservation({
      publishedSnapshot,
      publicationPackageId: input.publicationPackageId,
      governanceDecisionId: input.governanceDecisionId,
      preservationReason: input.reason,
      preservationMetadata: input.preservationMetadata,
      auditRecordId: input.auditRecordId,
      actor: input.actor
    });
    await publishedMemoryProjectionService.generateForPreservation(preservation);
    return preservation;
  },

  async generateFeedbackPackage(input: GenerateHistoricalLibraryFeedbackInput) {
    assertLibraryActor(input.actor);
    await verifyApprovedGovernanceDecision({
      governanceDecisionId: input.governanceDecisionId,
      expectedDecisionTypes: ["CREATE_FEEDBACK_PACKAGE"],
      expectedAuthorityType: "publication_package",
      expectedAuthorityId: input.publicationPackageId
    });
    const feedbackPackage = await governanceService.createFeedbackPackage({
      feedbackPackageId: randomUUID(),
      origin: {
        originService: "historical_library",
        originActor: input.actor,
        sourcePackageId: input.publicationPackageId
      },
      affectedAuthority: input.affectedAuthority,
      correctionClass: input.correctionClass,
      evidence: input.evidence,
      requiredResponse: input.requiredResponse,
      severity: input.severity,
      closureRequirements: input.closureRequirements,
      lifecycle: "created"
    });
    const feedbackLink = await historicalLibraryRepository.createFeedbackLink({
      lifecycleActionType: input.lifecycleActionType,
      lifecycleActionId: input.lifecycleActionId,
      feedbackPackageId: feedbackPackage.feedbackPackageId,
      publicationPackageId: input.publicationPackageId,
      sourcePublishedRecordId: input.sourcePublishedRecordId,
      targetPublishedRecordId: input.targetPublishedRecordId,
      actor: input.actor
    });
    return {
      feedbackPackage,
      feedbackLink
    };
  }
};
