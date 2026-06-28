import { randomUUID } from "node:crypto";
import { factoryRepository } from "@/src/server/repositories/factory-repository";
import { governanceRepository } from "@/src/server/repositories/governance-repository";
import { publishedMemoryProjectionRepository } from "@/src/server/repositories/published-memory-projection-repository";
import { buildGovernancePublicationPackage } from "@/src/server/services/factory-service";
import { governanceService } from "@/src/server/services/governance-service";
import { historicalLibraryService } from "@/src/server/services/historical-library-service";
import { publishedMemoryProjectionService } from "@/src/server/services/published-memory-projection-service";

const PACKAGE_VERSION_ID = "dbd74f2b-1cd7-4fe8-b85a-23f40d993d3b";
const FACTORY_ACTOR = { actorId: "publishing-certification", role: "factory_editor" as const, institutionId: "factory" };
const REVIEWER = { actorId: "publishing-certification", role: "senior_governance_reviewer" as const, institutionId: "governance" };
const LIBRARIAN = { actorId: "publishing-certification", role: "library_editor" as const, institutionId: "historical_library" };

async function approvedDecision(
  packageId: string,
  decisionType: "CERTIFY_PUBLICATION_READINESS" | "ACCEPT_PUBLICATION_PACKAGE",
  evidenceRefs: Awaited<ReturnType<typeof governanceRepository.getPublicationPackage>> extends infer P
    ? P extends { validationArtifacts: infer E } ? E : never
    : never
) {
  const decisionId = randomUUID();
  await governanceService.createDecision({
    decisionId,
    decisionType,
    targetAuthority: { authorityType: "publication_package", authorityId: packageId },
    actor: REVIEWER,
    evidenceRefs,
    rationale: {
      summary: `Operational certification: ${decisionType}.`,
      authorityBasis: ["Locked Publication Constitution", "Verified Factory lineage"]
    },
    approvalRefs: [],
    escalationRefs: [],
    outcome: "no_action",
    lifecycle: "draft"
  });
  await governanceService.submitDecision({ id: decisionId, actor: REVIEWER, reason: "Submit certification decision." });
  await governanceService.reviewDecision({ id: decisionId, actor: REVIEWER, reason: "Review certification decision." });
  const approvalId = randomUUID();
  const stepId = randomUUID();
  await governanceService.createApproval({
    approvalId,
    decisionId,
    request: {
      requestedBy: REVIEWER,
      requestedRole: "senior_governance_reviewer",
      targetAuthority: { authorityType: "publication_package", authorityId: packageId },
      reason: "Operational institutional certification."
    },
    steps: [{ stepId, sequence: 1, requiredRole: "senior_governance_reviewer" }],
    lifecycle: "requested"
  });
  await governanceService.requestApproval({ id: approvalId, actor: REVIEWER, reason: "Begin approval." });
  await governanceService.approveStep({ id: approvalId, stepId, actor: REVIEWER, reason: "Authority and evidence verified." });
  await governanceService.approveDecision({ id: decisionId, actor: REVIEWER, reason: "Approve certification decision." });
  return decisionId;
}

async function main() {
  const version = await factoryRepository.getPackageVersion(PACKAGE_VERSION_ID);
  if (!version) throw new Error("Certified Factory package version not found.");
  const draft = await factoryRepository.getPackageDraft(version.draftId);
  if (!draft) throw new Error("Certified Factory package draft not found.");
  const objects = await Promise.all(draft.factoryObjectRefs.map((id) => factoryRepository.getObject(id)));
  if (objects.some((object) => !object)) throw new Error("Factory canonical authority lineage is incomplete.");

  const packageInput = buildGovernancePublicationPackage(
    version,
    draft,
    FACTORY_ACTOR,
    randomUUID(),
    objects.filter((object): object is NonNullable<typeof object> => Boolean(object))
  );
  const existingPackage = (await governanceRepository.listPublicationPackages(1000)).find(
    (candidate) => candidate.factorySubmission?.factoryPackageVersionId === PACKAGE_VERSION_ID
  );
  if (existingPackage) {
    const publicationPackage = await governanceRepository.attachCanonicalAuthority(
      existingPackage.packageId,
      packageInput.canonicalAuthority || []
    );
    let packageForAdmission = publicationPackage;
    let acceptanceDecisionId: string | undefined;
    for (const decisionId of publicationPackage.decisionRefs) {
      const decision = await governanceRepository.getDecision(decisionId);
      if (decision?.decisionType === "ACCEPT_PUBLICATION_PACKAGE") {
        acceptanceDecisionId = decisionId;
        break;
      }
    }
    if (packageForAdmission.lifecycle === "readiness_certified") {
      packageForAdmission = await governanceService.submitPackageToLibraryReview({
        id: packageForAdmission.packageId,
        actor: REVIEWER,
        reason: "Submit certified package for Historical Library review."
      });
    }
    if (!acceptanceDecisionId) {
      acceptanceDecisionId = await approvedDecision(
        packageForAdmission.packageId,
        "ACCEPT_PUBLICATION_PACKAGE",
        packageForAdmission.validationArtifacts.filter((ref) => ref.evidenceType === "validated_evidence")
      );
    }
    if (packageForAdmission.lifecycle === "library_review") {
      packageForAdmission = await governanceService.acceptPackage({
        id: packageForAdmission.packageId,
        actor: REVIEWER,
        reason: "Accept canonical authority for Historical Library admission.",
        governanceDecisionId: acceptanceDecisionId
      });
    }
    if (packageForAdmission.lifecycle !== "accepted" && packageForAdmission.lifecycle !== "published") {
      throw new Error(`Existing certified package is not accepted: ${packageForAdmission.lifecycle}`);
    }
    const admission = await historicalLibraryService.admitPublicationPackage({
      packageId: packageForAdmission.packageId,
      governanceDecisionId: acceptanceDecisionId,
      actor: LIBRARIAN,
      reason: "Admit reconciled Governance-approved canonical authority.",
      requestedByService: "historical_library"
    });
    const retry = await historicalLibraryService.admitPublicationPackage({
      packageId: packageForAdmission.packageId,
      governanceDecisionId: acceptanceDecisionId,
      actor: LIBRARIAN,
      reason: "Verify idempotent admission.",
      requestedByService: "historical_library"
    });
    if (packageForAdmission.lifecycle === "accepted") {
      packageForAdmission = await governanceService.publishPackage({
        id: packageForAdmission.packageId,
        actor: LIBRARIAN,
        reason: "Published Memory and deterministic projections created."
      });
    }
    const rebuild = await publishedMemoryProjectionService.rebuildAll({ batchSize: 100 });
    const projections = Object.fromEntries(
      await Promise.all(
        ["timeline", "milestone", "historical_object", "relationship", "search", "sitemap"].map(async (type) => [
          type,
          (await publishedMemoryProjectionRepository.listActiveProjections(type as never, 1000)).filter((projection) =>
            admission.snapshots.some((snapshot) => snapshot.snapshotId === projection.publishedSnapshotId)
          ).length
        ])
      )
    );
    console.log(JSON.stringify({
      publicationPackageId: packageForAdmission.packageId,
      admissionId: admission.admission.admissionId,
      idempotentAdmission: retry.admission.admissionId === admission.admission.admissionId,
      canonicalAuthorityCount: packageForAdmission.canonicalAuthority?.length || 0,
      publishedSnapshotCount: admission.snapshots.length,
      lifecycle: packageForAdmission.lifecycle,
      rebuildStatus: rebuild.report.status,
      rebuildFailures: rebuild.report.rebuildFailures,
      projections
    }, null, 2));
    return;
  }
  const publicationPackage = await governanceService.createPublicationPackage(packageInput);
  await governanceService.submitPackage({
    id: publicationPackage.packageId,
    actor: REVIEWER,
    reason: "Submit complete Historical Publication Package."
  });
  const evidence = publicationPackage.validationArtifacts.filter((ref) => ref.evidenceType === "validated_evidence");
  const readinessDecisionId = await approvedDecision(publicationPackage.packageId, "CERTIFY_PUBLICATION_READINESS", evidence);
  await governanceService.certifyReadiness({
    id: publicationPackage.packageId,
    actor: REVIEWER,
    reason: "Package authority and evidence are publication ready.",
    governanceDecisionId: readinessDecisionId
  });
  await governanceService.submitPackageToLibraryReview({
    id: publicationPackage.packageId,
    actor: REVIEWER,
    reason: "Submit certified package for Library review."
  });
  const acceptanceDecisionId = await approvedDecision(publicationPackage.packageId, "ACCEPT_PUBLICATION_PACKAGE", evidence);
  await governanceService.acceptPackage({
    id: publicationPackage.packageId,
    actor: REVIEWER,
    reason: "Accept canonical authority for Historical Library admission.",
    governanceDecisionId: acceptanceDecisionId
  });
  const admission = await historicalLibraryService.admitPublicationPackage({
    packageId: publicationPackage.packageId,
    governanceDecisionId: acceptanceDecisionId,
    actor: LIBRARIAN,
    reason: "Admit Governance-approved canonical authority.",
    requestedByService: "historical_library"
  });
  const retry = await historicalLibraryService.admitPublicationPackage({
    packageId: publicationPackage.packageId,
    governanceDecisionId: acceptanceDecisionId,
    actor: LIBRARIAN,
    reason: "Verify idempotent admission.",
    requestedByService: "historical_library"
  });
  await governanceService.publishPackage({
    id: publicationPackage.packageId,
    actor: LIBRARIAN,
    reason: "Published Memory and deterministic projections created."
  });
  const projections = Object.fromEntries(
    await Promise.all(
      ["timeline", "milestone", "historical_object", "relationship", "search", "sitemap"].map(async (type) => [
        type,
        (await publishedMemoryProjectionRepository.listActiveProjections(type as never, 1000)).filter((projection) =>
          admission.snapshots.some((snapshot) => snapshot.snapshotId === projection.publishedSnapshotId)
        ).length
      ])
    )
  );
  console.log(JSON.stringify({
    publicationPackageId: publicationPackage.packageId,
    admissionId: admission.admission.admissionId,
    idempotentAdmission: retry.admission.admissionId === admission.admission.admissionId,
    canonicalAuthorityCount: publicationPackage.canonicalAuthority?.length || 0,
    publishedSnapshotCount: admission.snapshots.length,
    projections,
    readinessDecisionId,
    acceptanceDecisionId
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
