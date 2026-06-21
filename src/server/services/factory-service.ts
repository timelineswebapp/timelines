import { randomUUID } from "node:crypto";
import { ApiError } from "@/src/server/api/responses";
import type {
  FactoryArtifactType,
  FactoryFeedbackLifecycle,
  FactoryObjectLifecycle,
  FactoryObjectType,
  FactoryPackageDraft,
  FactoryPackageDraftLifecycle,
  FactoryPackageVersion,
  FactoryPackageType,
  FactoryRevisionPlanLifecycle
} from "@/src/server/factory/contracts";
import type { GovernanceActorRef, PublicationPackage } from "@/src/server/governance/contracts";
import { factoryRepository } from "@/src/server/repositories/factory-repository";
import { governanceRepository } from "@/src/server/repositories/governance-repository";
import { governanceService } from "@/src/server/services/governance-service";

type TransitionMap<T extends string> = Record<T, readonly T[]>;

const objectTransitions: TransitionMap<FactoryObjectLifecycle> = {
  draft: ["researching", "validated", "preserved"],
  researching: ["validated", "validation_failed", "preserved"],
  validated: ["package_candidate", "preserved"],
  validation_failed: ["researching", "preserved"],
  package_candidate: ["packaged", "preserved"],
  packaged: ["submitted_to_governance", "returned_for_revision", "preserved"],
  submitted_to_governance: ["returned_for_revision", "superseded", "preserved"],
  returned_for_revision: ["researching", "validated", "preserved"],
  superseded: ["preserved"],
  preserved: []
};

const packageDraftTransitions: TransitionMap<FactoryPackageDraftLifecycle> = {
  draft: ["validating", "preserved"],
  validating: ["ready_for_governance", "draft", "preserved"],
  ready_for_governance: ["submitted_to_governance", "preserved"],
  submitted_to_governance: ["returned_for_revision", "superseded", "preserved"],
  returned_for_revision: ["revised", "preserved"],
  revised: ["validating", "preserved"],
  superseded: ["preserved"],
  preserved: []
};

const feedbackTransitions: TransitionMap<FactoryFeedbackLifecycle> = {
  received: ["acknowledged", "preserved"],
  acknowledged: ["triaged", "preserved"],
  triaged: ["revision_required", "revision_in_progress", "resolved", "preserved"],
  revision_required: ["revision_in_progress", "preserved"],
  revision_in_progress: ["resubmission_prepared", "resolved", "preserved"],
  resubmission_prepared: ["resolved", "preserved"],
  resolved: ["closed", "preserved"],
  closed: ["preserved"],
  preserved: []
};

const revisionPlanTransitions: TransitionMap<FactoryRevisionPlanLifecycle> = {
  draft: ["approved", "preserved"],
  approved: ["in_progress", "preserved"],
  in_progress: ["resubmission_prepared", "resolved", "preserved"],
  resubmission_prepared: ["resolved", "preserved"],
  resolved: ["closed", "preserved"],
  closed: ["preserved"],
  preserved: []
};

type ActorInput = {
  actor: string;
  reason: string;
};

export type CreateFactoryObjectInput = ActorInput & {
  objectType: FactoryObjectType;
  title: string;
  payload: Record<string, unknown>;
  provenance: Record<string, unknown>;
};

export type CreateFactoryArtifactInput = ActorInput & {
  factoryObjectId?: string | null;
  artifactType: FactoryArtifactType;
  title: string;
  payload: Record<string, unknown>;
  authoritySafe: boolean;
  modelProvider?: string | null;
  modelName?: string | null;
};

export type CreateFactoryPackageDraftInput = ActorInput & {
  title: string;
  description: string;
  packageType: FactoryPackageType;
  factoryObjectRefs: string[];
  artifactRefs: string[];
  riskSummary: {
    unresolvedAuthorityRisks: string[];
    validationWarnings: string[];
    publicationBlockers: string[];
  };
  supersedesPackageId?: string | null;
};

export type SubmitFactoryPackageVersionInput = {
  packageVersionId: string;
  actor: GovernanceActorRef;
  reason: string;
};

export type IntakeFactoryFeedbackInput = ActorInput & {
  feedbackPackageId: string;
  affectedFactoryObjectIds: string[];
};

export type TransitionFactoryFeedbackInput = ActorInput & {
  feedbackConsumptionId: string;
  lifecycle: FactoryFeedbackLifecycle;
};

export type CreateFactoryRevisionPlanInput = ActorInput & {
  feedbackConsumptionId: string;
  planSummary: string;
  plannedActions: string[];
};

export type PrepareFactoryResubmissionInput = ActorInput & {
  revisionPlanId: string;
  title: string;
  description: string;
};

export type CompleteFactoryResubmissionInput = {
  revisionPlanId: string;
  actor: GovernanceActorRef;
  reason: string;
};

function assertTransitionAllowed<T extends string>(name: string, transitions: TransitionMap<T>, from: T, to: T): void {
  if (!transitions[from]?.includes(to)) {
    throw new ApiError(409, "INVALID_FACTORY_LIFECYCLE_TRANSITION", `${name} cannot transition from ${from} to ${to}.`);
  }
}

function assertNoPublicationBlockers(draft: FactoryPackageDraft): void {
  if (draft.riskSummary.publicationBlockers.length > 0) {
    throw new ApiError(409, "FACTORY_PACKAGE_BLOCKED", "Factory package draft has publication blockers.");
  }
}

export function assertFactoryCannotCertifyReadiness(): never {
  throw new ApiError(403, "FACTORY_CERTIFICATION_FORBIDDEN", "Factory cannot certify publication readiness.");
}

export function assertFactoryCannotApprovePackage(): never {
  throw new ApiError(403, "FACTORY_APPROVAL_FORBIDDEN", "Factory cannot approve Publication Packages.");
}

export function assertFactoryCannotRejectPackage(): never {
  throw new ApiError(403, "FACTORY_REJECTION_FORBIDDEN", "Factory cannot reject Publication Packages.");
}

export function assertFactoryCannotAdmitToHistoricalLibrary(): never {
  throw new ApiError(403, "FACTORY_LIBRARY_ADMISSION_FORBIDDEN", "Factory cannot admit records into Historical Library.");
}

export function assertFactoryCannotPublish(): never {
  throw new ApiError(403, "FACTORY_PUBLICATION_FORBIDDEN", "Factory cannot publish records or mutate public read models.");
}

export const factoryService = {
  async createObject(input: CreateFactoryObjectInput) {
    const created = await factoryRepository.createObject(input);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_object", authorityId: created.objectId },
      action: "create_object",
      actor: input.actor,
      reason: input.reason,
      afterState: created as unknown as Record<string, unknown>
    });
    return created;
  },

  async transitionObject(input: ActorInput & { objectId: string; lifecycle: FactoryObjectLifecycle }) {
    const current = await factoryRepository.getObject(input.objectId);
    if (!current) {
      throw new ApiError(404, "FACTORY_OBJECT_NOT_FOUND", "Factory object not found.");
    }
    assertTransitionAllowed("FactoryObject", objectTransitions, current.lifecycle, input.lifecycle);
    const updated = await factoryRepository.transitionObject(input.objectId, input.lifecycle, input.actor);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_object", authorityId: input.objectId },
      action: "transition_object",
      actor: input.actor,
      reason: input.reason,
      beforeState: current as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>
    });
    return updated;
  },

  async createArtifact(input: CreateFactoryArtifactInput) {
    if (input.factoryObjectId) {
      const object = await factoryRepository.getObject(input.factoryObjectId);
      if (!object) {
        throw new ApiError(404, "FACTORY_OBJECT_NOT_FOUND", "Factory object not found for artifact ownership.");
      }
    }
    const created = await factoryRepository.createArtifact(input);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_artifact", authorityId: created.artifactId },
      action: "create_artifact",
      actor: input.actor,
      reason: input.reason,
      afterState: created as unknown as Record<string, unknown>
    });
    return created;
  },

  async createPackageDraft(input: CreateFactoryPackageDraftInput) {
    if (input.factoryObjectRefs.length === 0) {
      throw new ApiError(409, "FACTORY_PACKAGE_OBJECTS_REQUIRED", "Factory package drafts require at least one Factory object reference.");
    }
    const created = await factoryRepository.createPackageDraft(input);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_draft", authorityId: created.packageDraftId },
      action: "create_package_draft",
      actor: input.actor,
      reason: input.reason,
      afterState: created as unknown as Record<string, unknown>
    });
    return created;
  },

  async transitionPackageDraft(input: ActorInput & { packageDraftId: string; lifecycle: FactoryPackageDraftLifecycle }) {
    const current = await factoryRepository.getPackageDraft(input.packageDraftId);
    if (!current) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    }
    assertTransitionAllowed("FactoryPackageDraft", packageDraftTransitions, current.lifecycle, input.lifecycle);
    if (input.lifecycle === "ready_for_governance") {
      assertNoPublicationBlockers(current);
    }
    const updated = await factoryRepository.transitionPackageDraft(input.packageDraftId, input.lifecycle, input.actor);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_draft", authorityId: input.packageDraftId },
      action: "transition_package_draft",
      actor: input.actor,
      reason: input.reason,
      beforeState: current as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>
    });
    return updated;
  },

  async createPackageVersion(input: ActorInput & { packageDraftId: string }) {
    const draft = await factoryRepository.getPackageDraft(input.packageDraftId);
    if (!draft) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    }
    if (draft.lifecycle !== "ready_for_governance") {
      throw new ApiError(409, "FACTORY_PACKAGE_NOT_READY", "Factory package versions require a ready_for_governance draft.");
    }
    assertNoPublicationBlockers(draft);
    const version = await factoryRepository.createPackageVersion({
      draft,
      actor: input.actor,
      packageSnapshot: {
        packageDraftId: draft.packageDraftId,
        title: draft.title,
        description: draft.description,
        packageType: draft.packageType,
        factoryObjectRefs: draft.factoryObjectRefs,
        artifactRefs: draft.artifactRefs,
        riskSummary: draft.riskSummary,
        lineageRootId: draft.lineageRootId || draft.packageDraftId,
        supersedesPackageId: draft.supersedesPackageId
      }
    });
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_version", authorityId: version.packageVersionId },
      action: "create_package_version",
      actor: input.actor,
      reason: input.reason,
      afterState: version as unknown as Record<string, unknown>
    });
    return version;
  },

  async markPackageVersionSubmitted(input: SubmitFactoryPackageVersionInput) {
    const existingSubmission = await factoryRepository.getGovernanceSubmissionByVersion(input.packageVersionId);
    if (existingSubmission) {
      const governancePackage = await governanceRepository.getPublicationPackage(existingSubmission.governancePublicationPackageId);
      return {
        submission: existingSubmission,
        governancePackage
      };
    }

    const packageVersion = await factoryRepository.getPackageVersion(input.packageVersionId);
    if (!packageVersion) {
      throw new ApiError(404, "FACTORY_PACKAGE_VERSION_NOT_FOUND", "Factory package version not found.");
    }
    if (packageVersion.lifecycle !== "draft") {
      throw new ApiError(409, "FACTORY_PACKAGE_VERSION_NOT_ELIGIBLE", "Only draft Factory package versions can be submitted to Governance.");
    }
    if (packageVersion.governancePublicationPackageId) {
      throw new ApiError(409, "FACTORY_PACKAGE_VERSION_ALREADY_LINKED", "Factory package version is already linked to a Governance PublicationPackage.");
    }

    const draft = await factoryRepository.getPackageDraft(packageVersion.draftId);
    if (!draft) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Factory package draft not found.");
    }
    if (draft.lifecycle !== "ready_for_governance") {
      throw new ApiError(409, "FACTORY_PACKAGE_DRAFT_NOT_READY", "Factory package draft must remain ready_for_governance before submission.");
    }
    assertNoPublicationBlockers(draft);

    const auditRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_version", authorityId: input.packageVersionId },
      action: "submit_package_version_to_governance",
      actor: input.actor.actorId,
      reason: input.reason,
      beforeState: packageVersion as unknown as Record<string, unknown>,
      afterState: {
        factoryPackageVersionId: packageVersion.packageVersionId,
        factoryPackageDraftId: packageVersion.draftId,
        factoryLineageRootId: packageVersion.lineageRootId,
        submittedBy: input.actor
      }
    });

    const governancePackageInput = buildGovernancePublicationPackage(packageVersion, draft, input.actor, auditRecordId);
    const governancePackage = await governanceService.createPublicationPackage(governancePackageInput);
    const submittedVersion = await factoryRepository.markPackageVersionSubmitted(
      input.packageVersionId,
      governancePackage.packageId
    );
    const submittedDraft = await factoryRepository.transitionPackageDraft(draft.packageDraftId, "submitted_to_governance", input.actor.actorId);
    const submission = await factoryRepository.createGovernanceSubmission({
      factoryPackageVersionId: submittedVersion.packageVersionId,
      factoryPackageDraftId: submittedVersion.draftId,
      factoryLineageRootId: submittedVersion.lineageRootId,
      governancePublicationPackageId: governancePackage.packageId,
      submissionActor: input.actor,
      submissionReason: input.reason,
      submissionAuditRecordId: auditRecordId
    });

    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_package_draft", authorityId: submittedDraft.packageDraftId },
      action: "transition_package_draft",
      actor: input.actor.actorId,
      reason: "Factory package draft submitted to Governance.",
      beforeState: draft as unknown as Record<string, unknown>,
      afterState: submittedDraft as unknown as Record<string, unknown>
    });

    return {
      submission,
      governancePackage,
      factoryPackageVersion: submittedVersion
    };
  },

  async intakeFeedbackPackage(input: IntakeFactoryFeedbackInput) {
    const existing = await factoryRepository.getFeedbackConsumptionByFeedbackPackage(input.feedbackPackageId);
    if (existing) {
      return existing;
    }

    const feedbackPackage = await governanceRepository.getFeedbackPackage(input.feedbackPackageId);
    if (!feedbackPackage) {
      throw new ApiError(404, "FEEDBACK_PACKAGE_NOT_FOUND", "FeedbackPackage not found.");
    }
    const governancePublicationPackageId = feedbackPackage.origin.sourcePackageId;
    if (!governancePublicationPackageId) {
      throw new ApiError(409, "FEEDBACK_SOURCE_PACKAGE_REQUIRED", "Factory feedback intake requires source Governance PublicationPackage linkage.");
    }
    const submission = await factoryRepository.getGovernanceSubmissionByGovernancePackage(governancePublicationPackageId);
    if (!submission) {
      throw new ApiError(409, "FACTORY_SUBMISSION_LINK_REQUIRED", "Feedback source package is not linked to Factory Production Memory.");
    }
    const auditRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "feedback_package", authorityId: input.feedbackPackageId },
      action: "intake_feedback_package",
      actor: input.actor,
      reason: input.reason,
      afterState: {
        feedbackPackageId: input.feedbackPackageId,
        governancePublicationPackageId,
        factoryPackageVersionId: submission.factoryPackageVersionId,
        affectedFactoryObjectIds: input.affectedFactoryObjectIds
      }
    });
    return factoryRepository.createFeedbackConsumption({
      feedbackPackageId: input.feedbackPackageId,
      governancePublicationPackageId,
      factoryPackageVersionId: submission.factoryPackageVersionId,
      factoryPackageDraftId: submission.factoryPackageDraftId,
      factoryLineageRootId: submission.factoryLineageRootId,
      affectedFactoryObjectIds: input.affectedFactoryObjectIds,
      classification: feedbackPackage.correctionClass,
      requiredResponse: feedbackPackage.requiredResponse,
      auditRecordId,
      actor: input.actor
    });
  },

  async transitionFeedbackConsumption(input: TransitionFactoryFeedbackInput) {
    const current = await factoryRepository.getFeedbackConsumption(input.feedbackConsumptionId);
    if (!current) {
      throw new ApiError(404, "FACTORY_FEEDBACK_CONSUMPTION_NOT_FOUND", "Factory feedback consumption not found.");
    }
    assertTransitionAllowed("FactoryFeedbackConsumption", feedbackTransitions, current.lifecycle, input.lifecycle);
    const updated = await factoryRepository.transitionFeedbackConsumption(input.feedbackConsumptionId, input.lifecycle, input.actor);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_feedback_consumption", authorityId: input.feedbackConsumptionId },
      action: "transition_feedback_consumption",
      actor: input.actor,
      reason: input.reason,
      beforeState: current as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>
    });
    return updated;
  },

  async createRevisionPlan(input: CreateFactoryRevisionPlanInput) {
    const consumption = await factoryRepository.getFeedbackConsumption(input.feedbackConsumptionId);
    if (!consumption) {
      throw new ApiError(404, "FACTORY_FEEDBACK_CONSUMPTION_NOT_FOUND", "Factory feedback consumption not found.");
    }
    if (consumption.lifecycle !== "revision_required" && consumption.lifecycle !== "triaged") {
      throw new ApiError(409, "FACTORY_FEEDBACK_REVISION_NOT_ALLOWED", "Revision plans require triaged or revision_required feedback.");
    }
    if (input.plannedActions.length === 0) {
      throw new ApiError(409, "REVISION_ACTIONS_REQUIRED", "Revision plan requires at least one planned action.");
    }
    const auditRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_feedback_consumption", authorityId: input.feedbackConsumptionId },
      action: "create_revision_plan",
      actor: input.actor,
      reason: input.reason,
      beforeState: consumption as unknown as Record<string, unknown>,
      afterState: {
        planSummary: input.planSummary,
        plannedActions: input.plannedActions
      }
    });
    const plan = await factoryRepository.createRevisionPlan({
      feedbackConsumption: consumption,
      planSummary: input.planSummary,
      plannedActions: input.plannedActions,
      auditRecordId,
      actor: input.actor
    });
    await factoryRepository.transitionFeedbackConsumption(input.feedbackConsumptionId, "revision_in_progress", input.actor, plan.revisionPlanId);
    return plan;
  },

  async prepareResubmission(input: PrepareFactoryResubmissionInput) {
    const plan = await factoryRepository.getRevisionPlan(input.revisionPlanId);
    if (!plan) {
      throw new ApiError(404, "FACTORY_REVISION_PLAN_NOT_FOUND", "Factory revision plan not found.");
    }
    if (plan.lifecycle !== "draft" && plan.lifecycle !== "approved" && plan.lifecycle !== "in_progress") {
      throw new ApiError(409, "REVISION_PLAN_RESUBMISSION_NOT_ALLOWED", "Revision plan cannot prepare resubmission from current lifecycle.");
    }
    assertTransitionAllowed("FactoryRevisionPlan", revisionPlanTransitions, plan.lifecycle, "resubmission_prepared");
    if (!plan.factoryPackageDraftId || plan.affectedFactoryObjectIds.length === 0) {
      throw new ApiError(409, "RESUBMISSION_LINEAGE_REQUIRED", "Resubmission requires source package draft and affected Factory objects.");
    }
    const sourceDraft = await factoryRepository.getPackageDraft(plan.factoryPackageDraftId);
    if (!sourceDraft) {
      throw new ApiError(404, "FACTORY_PACKAGE_DRAFT_NOT_FOUND", "Source Factory package draft not found.");
    }
    const resubmissionDraft = await factoryRepository.createPackageDraft({
      title: input.title,
      description: input.description,
      packageType: sourceDraft.packageType,
      factoryObjectRefs: Array.from(new Set([...sourceDraft.factoryObjectRefs, ...plan.affectedFactoryObjectIds])),
      artifactRefs: sourceDraft.artifactRefs,
      riskSummary: {
        unresolvedAuthorityRisks: [],
        validationWarnings: [`Prepared from revision plan ${plan.revisionPlanId}.`],
        publicationBlockers: []
      },
      supersedesPackageId: sourceDraft.packageDraftId,
      actor: input.actor
    });
    const updatedPlan = await factoryRepository.transitionRevisionPlan(
      input.revisionPlanId,
      "resubmission_prepared",
      input.actor,
      resubmissionDraft.packageDraftId
    );
    await factoryRepository.transitionFeedbackConsumption(plan.feedbackConsumptionId, "resubmission_prepared", input.actor, plan.revisionPlanId);
    await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_revision_plan", authorityId: input.revisionPlanId },
      action: "prepare_resubmission",
      actor: input.actor,
      reason: input.reason,
      beforeState: plan as unknown as Record<string, unknown>,
      afterState: {
        revisionPlan: updatedPlan,
        resubmissionPackageDraft: resubmissionDraft
      }
    });
    return {
      revisionPlan: updatedPlan,
      resubmissionPackageDraft: resubmissionDraft
    };
  },

  async completeResubmission(input: CompleteFactoryResubmissionInput) {
    const plan = await factoryRepository.getRevisionPlan(input.revisionPlanId);
    if (!plan) {
      throw new ApiError(404, "FACTORY_REVISION_PLAN_NOT_FOUND", "Factory revision plan not found.");
    }
    if (plan.newPackageVersionId) {
      const factoryPackageVersion = await factoryRepository.getPackageVersion(plan.newPackageVersionId);
      const submission = factoryPackageVersion
        ? await factoryRepository.getGovernanceSubmissionByVersion(factoryPackageVersion.packageVersionId)
        : null;
      const governancePackage = submission
        ? await governanceRepository.getPublicationPackage(submission.governancePublicationPackageId)
        : null;
      return {
        revisionPlan: plan,
        factoryPackageVersion,
        submission,
        governancePackage
      };
    }
    if (plan.lifecycle !== "resubmission_prepared") {
      throw new ApiError(409, "REVISION_PLAN_NOT_PREPARED", "Revision plan must be resubmission_prepared before completion.");
    }
    assertTransitionAllowed("FactoryRevisionPlan", revisionPlanTransitions, plan.lifecycle, "resolved");
    if (!plan.resubmissionPackageDraftId || !plan.factoryPackageVersionId || !plan.factoryPackageDraftId || !plan.factoryLineageRootId) {
      throw new ApiError(409, "RESUBMISSION_LINKAGE_INCOMPLETE", "Revision plan is missing required resubmission lineage links.");
    }

    const [resubmissionDraft, supersededVersion] = await Promise.all([
      factoryRepository.getPackageDraft(plan.resubmissionPackageDraftId),
      factoryRepository.getPackageVersion(plan.factoryPackageVersionId)
    ]);
    if (!resubmissionDraft) {
      throw new ApiError(404, "RESUBMISSION_DRAFT_NOT_FOUND", "Prepared resubmission package draft not found.");
    }
    if (!supersededVersion) {
      throw new ApiError(404, "SUPERSEDED_PACKAGE_VERSION_NOT_FOUND", "Superseded Factory package version not found.");
    }
    if (resubmissionDraft.lifecycle !== "ready_for_governance") {
      throw new ApiError(409, "RESUBMISSION_DRAFT_NOT_READY", "Prepared resubmission draft must be ready_for_governance before completion.");
    }
    if (resubmissionDraft.lineageRootId !== plan.factoryLineageRootId || supersededVersion.lineageRootId !== plan.factoryLineageRootId) {
      throw new ApiError(409, "RESUBMISSION_LINEAGE_MISMATCH", "Resubmission lineage root does not match the originating Factory lineage.");
    }
    if (resubmissionDraft.supersedesPackageId !== plan.factoryPackageDraftId) {
      throw new ApiError(409, "RESUBMISSION_DRAFT_SUPERSESSION_MISMATCH", "Resubmission draft must supersede the source Factory package draft.");
    }
    if (supersededVersion.lifecycle !== "submitted_to_governance") {
      throw new ApiError(409, "SUPERSEDED_VERSION_NOT_SUBMITTED", "Only submitted Factory package versions can be superseded by resubmission.");
    }
    assertNoPublicationBlockers(resubmissionDraft);

    const resubmissionAuditRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_revision_plan", authorityId: input.revisionPlanId },
      action: "create_resubmission_package_version",
      actor: input.actor.actorId,
      reason: input.reason,
      beforeState: {
        revisionPlan: plan,
        supersededPackageVersion: supersededVersion
      } as unknown as Record<string, unknown>,
      afterState: {
        resubmissionPackageDraftId: resubmissionDraft.packageDraftId,
        supersededPackageVersionId: supersededVersion.packageVersionId,
        feedbackPackageId: plan.feedbackPackageId
      }
    });

    const packageVersion = await factoryRepository.createPackageVersion({
      draft: resubmissionDraft,
      actor: input.actor.actorId,
      supersedesVersionId: supersededVersion.packageVersionId,
      feedbackPackageRefs: [plan.feedbackPackageId],
      revisionPlanId: plan.revisionPlanId,
      sourceFeedbackPackageId: plan.feedbackPackageId,
      resubmissionAuditRecordId,
      packageSnapshot: {
        packageDraftId: resubmissionDraft.packageDraftId,
        title: resubmissionDraft.title,
        description: resubmissionDraft.description,
        packageType: resubmissionDraft.packageType,
        factoryObjectRefs: resubmissionDraft.factoryObjectRefs,
        artifactRefs: resubmissionDraft.artifactRefs,
        riskSummary: resubmissionDraft.riskSummary,
        lineageRootId: resubmissionDraft.lineageRootId,
        supersedesPackageId: resubmissionDraft.supersedesPackageId,
        supersededPackageVersionId: supersededVersion.packageVersionId,
        revisionPlanId: plan.revisionPlanId,
        feedbackPackageId: plan.feedbackPackageId
      }
    });

    const submissionResult = await factoryService.markPackageVersionSubmitted({
      packageVersionId: packageVersion.packageVersionId,
      actor: input.actor,
      reason: input.reason
    });
    const submittedVersion = submissionResult.factoryPackageVersion || packageVersion;
    const revisionCompletionRecordId = await factoryRepository.createAuditRecord({
      targetRef: { authorityType: "factory_revision_plan", authorityId: input.revisionPlanId },
      action: "complete_resubmission",
      actor: input.actor.actorId,
      reason: input.reason,
      beforeState: plan as unknown as Record<string, unknown>,
      afterState: {
        supersededPackageVersionId: supersededVersion.packageVersionId,
        newPackageVersionId: submittedVersion.packageVersionId,
        feedbackPackageId: plan.feedbackPackageId,
        governancePublicationPackageId: submissionResult.governancePackage?.packageId || null
      }
    });
    const completedPlan = await factoryRepository.completeRevisionPlan({
      revisionPlanId: input.revisionPlanId,
      supersededPackageVersionId: supersededVersion.packageVersionId,
      newPackageVersionId: submittedVersion.packageVersionId,
      governancePublicationPackageId: submissionResult.governancePackage?.packageId || submissionResult.submission.governancePublicationPackageId,
      submissionAuditRecordId: submissionResult.submission.submissionAuditRecordId,
      revisionCompletionRecordId,
      actor: input.actor.actorId
    });
    await factoryRepository.transitionFeedbackConsumption(
      plan.feedbackConsumptionId,
      "resolved",
      input.actor.actorId,
      plan.revisionPlanId,
      revisionCompletionRecordId
    );

    return {
      revisionPlan: completedPlan,
      factoryPackageVersion: submittedVersion,
      submission: submissionResult.submission,
      governancePackage: submissionResult.governancePackage
    };
  },

  certifyReadiness: assertFactoryCannotCertifyReadiness,
  approvePackage: assertFactoryCannotApprovePackage,
  rejectPackage: assertFactoryCannotRejectPackage,
  admitToHistoricalLibrary: assertFactoryCannotAdmitToHistoricalLibrary,
  publish: assertFactoryCannotPublish
};

function buildGovernancePublicationPackage(
  packageVersion: FactoryPackageVersion,
  draft: FactoryPackageDraft,
  actor: GovernanceActorRef,
  auditRecordId: string
): PublicationPackage {
  return {
    packageId: randomUUID(),
    scope: {
      packageType: draft.packageType,
      description: draft.description
    },
    includedAuthority: [
      {
        authorityType: "publication_package",
        authorityId: packageVersion.packageVersionId
      }
    ],
    validationArtifacts: draft.artifactRefs.map((artifactId) => ({
      evidenceId: artifactId,
      evidenceType: "factory_validation" as const,
      authoritySafe: true
    })),
    decisionRefs: [],
    riskSummary: {
      unresolvedAuthorityRisks: draft.riskSummary.unresolvedAuthorityRisks,
      disputeRefs: [],
      validationWarnings: draft.riskSummary.validationWarnings,
      publicationBlockers: draft.riskSummary.publicationBlockers
    },
    factorySubmission: {
      factoryPackageVersionId: packageVersion.packageVersionId,
      factoryPackageDraftId: packageVersion.draftId,
      factoryLineageRootId: packageVersion.lineageRootId,
      submittedBy: actor,
      submissionAuditRecordId: auditRecordId
    },
    lifecycle: "factory_ready"
  };
}
