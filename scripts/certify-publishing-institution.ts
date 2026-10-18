import { randomUUID } from "node:crypto";
import { factoryRepository } from "@/src/server/repositories/factory-repository";
import { governanceRepository } from "@/src/server/repositories/governance-repository";
import { publishedMemoryProjectionRepository } from "@/src/server/repositories/published-memory-projection-repository";
import { buildGovernancePublicationPackage } from "@/src/server/services/factory-service";
import { governanceService } from "@/src/server/services/governance-service";
import { historicalLibraryService } from "@/src/server/services/historical-library-service";
import { publishedMemoryProjectionService } from "@/src/server/services/published-memory-projection-service";
import { closeSql, getWriteSql } from "@/src/server/db/client";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";
import type { AdminOperatorIdentity } from "@/src/server/security/admin-identity";
import type { GovernanceActorRef } from "@/src/server/governance/contracts";

const DEFAULT_PACKAGE_VERSION_ID = "dbd74f2b-1cd7-4fe8-b85a-23f40d993d3b";

const GOVERNANCE_SCOPES = [
  "governance.decision.create",
  "governance.decision.submit",
  "governance.decision.review",
  "governance.approval.create",
  "governance.approval.approve_step",
  "governance.decision.approve",
  "governance.publication.submit",
  "governance.publication.certify_readiness",
  "governance.publication.submit_library_review",
  "governance.publication.accept",
  "governance.publication.publish"
] as const;

type InstitutionalActors = {
  factory: GovernanceActorRef;
  governance: Record<(typeof GOVERNANCE_SCOPES)[number], GovernanceActorRef>;
  library: GovernanceActorRef;
};

function syntheticIdentity(principal: string, roles: AdminOperatorIdentity["roles"]): AdminOperatorIdentity {
  return {
    operatorId: principal,
    displayName: `Synthetic staging fixture ${principal}`,
    roles,
    authMethod: "operator_token",
    mfaVerified: true,
    sessionId: null
  };
}

async function resolveSyntheticInstitutionalActors(): Promise<InstitutionalActors> {
  if (process.env.SYNTHETIC_CERTIFICATION !== "true") {
    throw new Error("Institutional publication certification only runs in explicit synthetic mode.");
  }
  if (process.env.TIMELINES_ENVIRONMENT !== "staging") {
    throw new Error("Synthetic institutional certification requires TIMELINES_ENVIRONMENT=staging.");
  }
  if (process.env.ALLOW_SYNTHETIC_GOVERNANCE_CERTIFICATION !== "true") {
    throw new Error("Synthetic institutional certification requires its explicit authorization flag.");
  }
  const runId = process.env.STAGING_SYNTHETIC_FIXTURE_RUN_ID;
  if (!runId || !/^tl-staging-004-[a-z0-9-]{8,80}$/.test(runId)) {
    throw new Error("STAGING_SYNTHETIC_FIXTURE_RUN_ID must be an explicit TL-STAGING-004 fixture identifier.");
  }

  const factoryIdentity = syntheticIdentity(`${runId}-factory`, ["admin", "factory_operator"]);
  const governanceIdentity = syntheticIdentity(`${runId}-governance`, ["admin", "governance_operator"]);
  const libraryIdentity = syntheticIdentity(`${runId}-library`, ["admin", "library_operator"]);
  const governance = Object.fromEntries(await Promise.all(
    GOVERNANCE_SCOPES.map(async (scope) => [
      scope,
      await resolveInstitutionalActor(governanceIdentity, scope, ["governance"])
    ])
  )) as InstitutionalActors["governance"];
  return {
    factory: await resolveInstitutionalActor(factoryIdentity, "factory.publication.submit", ["factory"]),
    governance,
    library: await resolveInstitutionalActor(libraryIdentity, "historical_library.admission.admit", ["historical_library"])
  };
}

async function approvedDecision(
  packageId: string,
  decisionType: "CERTIFY_PUBLICATION_READINESS" | "ACCEPT_PUBLICATION_PACKAGE",
  actors: InstitutionalActors,
  evidenceRefs: Awaited<ReturnType<typeof governanceRepository.getPublicationPackage>> extends infer P
    ? P extends { validationArtifacts: infer E } ? E : never
    : never
) {
  const decisionId = randomUUID();
  await governanceService.createDecision({
    decisionId,
    decisionType,
    targetAuthority: { authorityType: "publication_package", authorityId: packageId },
    actor: actors.governance["governance.decision.create"],
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
  await governanceService.submitDecision({ id: decisionId, actor: actors.governance["governance.decision.submit"], reason: "Submit certification decision." });
  await governanceService.reviewDecision({ id: decisionId, actor: actors.governance["governance.decision.review"], reason: "Review certification decision." });
  const approvalId = randomUUID();
  const stepId = randomUUID();
  await governanceService.createApproval({
    approvalId,
    decisionId,
    request: {
      requestedBy: actors.governance["governance.approval.create"],
      requestedRole: "senior_governance_reviewer",
      targetAuthority: { authorityType: "publication_package", authorityId: packageId },
      reason: "Operational institutional certification."
    },
    steps: [{ stepId, sequence: 1, requiredRole: "senior_governance_reviewer" }],
    lifecycle: "requested"
  });
  await governanceService.requestApproval({ id: approvalId, actor: actors.governance["governance.approval.create"], reason: "Begin approval." });
  await governanceService.approveStep({ id: approvalId, stepId, actor: actors.governance["governance.approval.approve_step"], reason: "Authority and evidence verified." });
  await governanceService.approveDecision({ id: decisionId, actor: actors.governance["governance.decision.approve"], reason: "Approve certification decision." });
  return decisionId;
}

async function main() {
  const actors = await resolveSyntheticInstitutionalActors();
  let packageVersionId = process.env.CERTIFICATION_PACKAGE_VERSION_ID || DEFAULT_PACKAGE_VERSION_ID;
  let version = process.env.SYNTHETIC_CERTIFICATION === "true"
    ? null
    : await factoryRepository.getPackageVersion(packageVersionId);
  if (process.env.SYNTHETIC_CERTIFICATION === "true") {
    const sql = getWriteSql("selecting isolated certification package");
    const [candidate] = await sql<{ id: string }[]>`
      SELECT v.id::text AS id FROM factory_package_versions v
      JOIN factory_package_drafts d ON d.id=v.draft_id
      WHERE v.lifecycle='draft' AND d.lifecycle='ready_for_governance'
        AND v.governance_publication_package_id IS NULL
        AND jsonb_array_length(v.validated_evidence_refs) > 0
      ORDER BY v.created_at DESC LIMIT 1`;
    if (candidate) {
      packageVersionId = candidate.id;
      version = await factoryRepository.getPackageVersion(packageVersionId);
    }
  }
  if (!version) throw new Error("Certified Factory package version not found.");
  const draft = await factoryRepository.getPackageDraft(version.draftId);
  if (!draft) throw new Error("Certified Factory package draft not found.");
  const objects = await Promise.all(draft.factoryObjectRefs.map((id) => factoryRepository.getObject(id)));
  if (objects.some((object) => !object)) throw new Error("Factory canonical authority lineage is incomplete.");

  const packageInput = buildGovernancePublicationPackage(
    version,
    draft,
    actors.factory,
    randomUUID(),
    objects.filter((object): object is NonNullable<typeof object> => Boolean(object))
  );
  const existingPackage = (await governanceRepository.listPublicationPackages(1000)).find(
    (candidate) => candidate.factorySubmission?.factoryPackageVersionId === packageVersionId
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
        actor: actors.governance["governance.publication.submit_library_review"],
        reason: "Submit certified package for Historical Library review."
      });
    }
    if (!acceptanceDecisionId) {
      acceptanceDecisionId = await approvedDecision(
        packageForAdmission.packageId,
        "ACCEPT_PUBLICATION_PACKAGE", actors,
        packageForAdmission.validationArtifacts.filter((ref) => ref.evidenceType === "validated_evidence")
      );
    }
    if (packageForAdmission.lifecycle === "library_review") {
      packageForAdmission = await governanceService.acceptPackage({
        id: packageForAdmission.packageId,
        actor: actors.governance["governance.publication.accept"],
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
      actor: actors.library,
      reason: "Admit reconciled Governance-approved canonical authority.",
      requestedByService: "historical_library"
    });
    const retry = await historicalLibraryService.admitPublicationPackage({
      packageId: packageForAdmission.packageId,
      governanceDecisionId: acceptanceDecisionId,
      actor: actors.library,
      reason: "Verify idempotent admission.",
      requestedByService: "historical_library"
    });
    if (packageForAdmission.lifecycle === "accepted") {
      packageForAdmission = await governanceService.publishPackage({
        id: packageForAdmission.packageId,
        actor: actors.governance["governance.publication.publish"],
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
    actor: actors.governance["governance.publication.submit"],
    reason: "Submit complete Historical Publication Package."
  });
  const evidence = publicationPackage.validationArtifacts.filter((ref) => ref.evidenceType === "validated_evidence");
  const readinessDecisionId = await approvedDecision(publicationPackage.packageId, "CERTIFY_PUBLICATION_READINESS", actors, evidence);
  await governanceService.certifyReadiness({
    id: publicationPackage.packageId,
    actor: actors.governance["governance.publication.certify_readiness"],
    reason: "Package authority and evidence are publication ready.",
    governanceDecisionId: readinessDecisionId
  });
  await governanceService.submitPackageToLibraryReview({
    id: publicationPackage.packageId,
    actor: actors.governance["governance.publication.submit_library_review"],
    reason: "Submit certified package for Library review."
  });
  const acceptanceDecisionId = await approvedDecision(publicationPackage.packageId, "ACCEPT_PUBLICATION_PACKAGE", actors, evidence);
  await governanceService.acceptPackage({
    id: publicationPackage.packageId,
    actor: actors.governance["governance.publication.accept"],
    reason: "Accept canonical authority for Historical Library admission.",
    governanceDecisionId: acceptanceDecisionId
  });
  const admission = await historicalLibraryService.admitPublicationPackage({
    packageId: publicationPackage.packageId,
    governanceDecisionId: acceptanceDecisionId,
    actor: actors.library,
    reason: "Admit Governance-approved canonical authority.",
    requestedByService: "historical_library"
  });
  const retry = await historicalLibraryService.admitPublicationPackage({
    packageId: publicationPackage.packageId,
    governanceDecisionId: acceptanceDecisionId,
    actor: actors.library,
    reason: "Verify idempotent admission.",
    requestedByService: "historical_library"
  });
  await governanceService.publishPackage({
    id: publicationPackage.packageId,
    actor: actors.governance["governance.publication.publish"],
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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSql();
    process.exit(process.exitCode ?? 0);
  });
