import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ApiError } from "@/src/server/api/responses";
import {
  assertGovernanceDecisionRequired,
  assertLifecycleTransition,
  disputeTransitions,
  governanceDecisionTransitions,
  publicationPackageTransitions
} from "@/src/server/governance/lifecycle";
import { assertFactoryCannotPublish, assertPlatformReadOnly, assertServiceMayPerformAction } from "@/src/server/governance/service-boundaries";
import { governanceService } from "@/src/server/services/governance-service";

const validUuid = "123e4567-e89b-12d3-a456-426614174000";
const actor = {
  actorId: "governance-admin",
  role: "governance_reviewer" as const,
  institutionId: "timelines-governance"
};

describe("governance contracts implementation", () => {
  it("enforces GovernanceDecision lifecycle transitions", () => {
    assert.doesNotThrow(() =>
      assertLifecycleTransition("GovernanceDecision", governanceDecisionTransitions, "under_review", "approval_pending")
    );
    assert.throws(
      () => assertLifecycleTransition("GovernanceDecision", governanceDecisionTransitions, "approved", "draft"),
      ApiError
    );
  });

  it("enforces PublicationPackage and Dispute terminal state machines", () => {
    assert.doesNotThrow(() =>
      assertLifecycleTransition("PublicationPackage", publicationPackageTransitions, "readiness_certified", "library_review")
    );
    assert.throws(
      () => assertLifecycleTransition("PublicationPackage", publicationPackageTransitions, "published", "factory_draft"),
      ApiError
    );
    assert.throws(() => assertLifecycleTransition("Dispute", disputeTransitions, "closed", "review_pending"), ApiError);
  });

  it("blocks service boundary violations", () => {
    assert.throws(() => assertPlatformReadOnly("platform"), ApiError);
    assert.throws(() => assertServiceMayPerformAction("platform", "approve"), ApiError);
    assert.throws(() => assertFactoryCannotPublish("factory", "certify_ready"), ApiError);
    assert.doesNotThrow(() => assertServiceMayPerformAction("governance", "approve"));
  });

  it("requires governance decisions before authority mutations", () => {
    assert.throws(() => assertGovernanceDecisionRequired(undefined, "Revising historical object"), ApiError);
    assert.doesNotThrow(() => assertGovernanceDecisionRequired(validUuid, "Revising historical object"));
  });

  it("rejects direct terminal lifecycle creation", () => {
    assert.throws(
      () =>
        governanceService.createPublicationPackage({
          packageId: validUuid,
          scope: { packageType: "historical_object_publication", description: "Publish vetted authority." },
          includedAuthority: [{ authorityType: "historical_object", authorityId: validUuid }],
          validationArtifacts: [],
          decisionRefs: [],
          riskSummary: {
            unresolvedAuthorityRisks: [],
            disputeRefs: [],
            validationWarnings: [],
            publicationBlockers: []
          },
          lifecycle: "published"
        }),
      ApiError
    );

    assert.throws(
      () =>
        governanceService.createDispute({
          disputeId: validUuid,
          targetAuthority: { authorityType: "participation", authorityId: validUuid },
          disputeClass: "participation_conflict",
          evidenceBundle: [],
          severity: "material",
          resolutionPath: "standard_review",
          outcome: "upheld",
          lifecycle: "resolved_upheld"
        }),
      ApiError
    );
  });

  it("rejects unsafe evidence before persistence", () => {
    assert.throws(
      () =>
        governanceService.createDecision({
          decisionId: validUuid,
          decisionType: "ADMIT_HISTORICAL_OBJECT",
          targetAuthority: { authorityType: "historical_object", authorityId: validUuid },
          actor,
          evidenceRefs: [{ evidenceId: "source-1", evidenceType: "source", authoritySafe: false }],
          rationale: { summary: "Admit verified object.", authorityBasis: ["governance-lock"] },
          approvalRefs: [],
          escalationRefs: [],
          outcome: "approved",
          lifecycle: "approved"
        }),
      ApiError
    );
  });

  it("requires audit reconstruction decision and transition chains", () => {
    assert.throws(
      () =>
        governanceService.createAuditRecord({
          auditRecordId: validUuid,
          authorityRef: { authorityType: "historical_object", authorityId: validUuid },
          decisionRefs: [],
          approvalRefs: [],
          evidenceRefs: [],
          packageRefs: [],
          disputeRefs: [],
          finalState: "active",
          reconstruction: {
            actorChain: [actor],
            stateTransitions: []
          }
        }),
      ApiError
    );
  });

  it("defines governance persistence and no-delete preservation", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_governance_contracts.sql", "utf8");

    for (const table of [
      "governance_decisions",
      "governance_approvals",
      "governance_queues",
      "governance_publication_packages",
      "governance_feedback_packages",
      "governance_disputes",
      "governance_audit_records"
    ]) {
      assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
      assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
      assert.match(schema, new RegExp(`prevent_${table}_delete`));
    }
  });

  it("wires historical authority mutations through GovernanceDecision guards", () => {
    const repository = readFileSync("src/server/repositories/historical-authority-repository.ts", "utf8");
    const governanceRepository = readFileSync("src/server/repositories/governance-repository.ts", "utf8");

    assert.match(governanceRepository, /export async function verifyApprovedGovernanceDecision/);
    assert.match(governanceRepository, /GOVERNANCE_DECISION_NOT_FOUND/);
    assert.match(governanceRepository, /GOVERNANCE_DECISION_NOT_APPROVED/);
    assert.match(governanceRepository, /GOVERNANCE_DECISION_TYPE_MISMATCH/);
    assert.match(governanceRepository, /GOVERNANCE_DECISION_TARGET_MISMATCH/);
    assert.match(governanceRepository, /GOVERNANCE_DECISION_APPROVAL_REQUIRED/);

    assert.match(repository, /assertGovernanceDecisionRequired\(input\.governanceDecisionId, "Creating historical object"/);
    assert.match(repository, /verifyApprovedGovernanceDecision\(\{[\s\S]*expectedDecisionTypes: \["ADMIT_HISTORICAL_OBJECT"\]/);
    assert.match(repository, /assertGovernanceDecisionRequired\(input\.governanceDecisionId, "Merging historical object"/);
    assert.match(repository, /expectedDecisionTypes: \["MERGE_HISTORICAL_OBJECT"\]/);
    assert.match(repository, /assertGovernanceDecisionRequired\(input\.governanceDecisionId, "Disputing milestone participation"/);
    assert.match(repository, /expectedDecisionTypes: \["OPEN_DISPUTE"\]/);
  });

  it("defines service-owned lifecycle transition methods with audit generation", () => {
    const service = readFileSync("src/server/services/governance-service.ts", "utf8");
    const repository = readFileSync("src/server/repositories/governance-repository.ts", "utf8");

    for (const method of [
      "submitDecision",
      "reviewDecision",
      "approveDecision",
      "rejectDecision",
      "escalateDecision",
      "supersedeDecision",
      "requestApproval",
      "approveStep",
      "rejectStep",
      "escalateApproval",
      "completeApprovalChain",
      "enterQueue",
      "advanceQueue",
      "exitQueue",
      "escalateQueue",
      "submitPackage",
      "certifyReadiness",
      "acceptPackage",
      "rejectPackage",
      "returnPackage",
      "publishPackage",
      "deliverFeedback",
      "acknowledgeFeedback",
      "resolveFeedback",
      "closeFeedback",
      "triageDispute",
      "escalateDispute",
      "resolveDispute",
      "closeDispute"
    ]) {
      assert.match(service, new RegExp(`${method}\\(input`));
    }

    assert.match(service, /assertLifecycleTransition\("GovernanceDecision", governanceDecisionTransitions/);
    assert.match(service, /assertLifecycleTransition\("Approval", approvalTransitions/);
    assert.match(service, /assertLifecycleTransition\("GovernanceQueue", governanceQueueTransitions/);
    assert.match(service, /assertLifecycleTransition\("PublicationPackage", publicationPackageTransitions/);
    assert.match(service, /assertLifecycleTransition\("FeedbackPackage", feedbackPackageTransitions/);
    assert.match(service, /assertLifecycleTransition\("Dispute", disputeTransitions/);
    assert.match(service, /auditTransition\(/);
    assert.match(repository, /async createTransitionAudit/);
    assert.match(repository, /transitionDecision/);
    assert.match(repository, /transitionApproval/);
    assert.match(repository, /transitionPublicationPackage/);
    assert.match(repository, /transitionDispute/);
  });

  it("exposes transition APIs through adminService and routes without repository imports", () => {
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const routeFiles = listFiles("app/api/admin/governance").filter((file) => file.endsWith("route.ts"));

    for (const method of [
      "submitGovernanceDecision",
      "reviewGovernanceDecision",
      "approveGovernanceDecision",
      "rejectGovernanceDecision",
      "escalateGovernanceDecision",
      "supersedeGovernanceDecision",
      "approveGovernanceApprovalStep",
      "rejectGovernanceApprovalStep",
      "completeGovernanceApprovalChain",
      "advanceGovernanceQueue",
      "escalateGovernanceQueue",
      "certifyPublicationReadiness",
      "acceptPublicationPackage",
      "rejectPublicationPackage",
      "returnPublicationPackage",
      "publishPublicationPackage",
      "acknowledgeFeedbackPackage",
      "resolveFeedbackPackage",
      "closeFeedbackPackage",
      "triageGovernanceDispute",
      "escalateGovernanceDispute",
      "resolveGovernanceDispute",
      "closeGovernanceDispute"
    ]) {
      assert.match(adminService, new RegExp(`${method}: governanceService\\.`));
    }

    for (const endpoint of [
      "decisions/[id]/submit/route.ts",
      "decisions/[id]/review/route.ts",
      "decisions/[id]/approve/route.ts",
      "decisions/[id]/reject/route.ts",
      "decisions/[id]/escalate/route.ts",
      "decisions/[id]/supersede/route.ts",
      "approvals/[id]/approve-step/route.ts",
      "approvals/[id]/reject-step/route.ts",
      "approvals/[id]/complete-chain/route.ts",
      "queues/[id]/advance/route.ts",
      "queues/[id]/escalate/route.ts",
      "publication-packages/[id]/certify-readiness/route.ts",
      "publication-packages/[id]/accept/route.ts",
      "publication-packages/[id]/reject/route.ts",
      "publication-packages/[id]/return/route.ts",
      "publication-packages/[id]/publish/route.ts",
      "feedback-packages/[id]/acknowledge/route.ts",
      "feedback-packages/[id]/resolve/route.ts",
      "feedback-packages/[id]/close/route.ts",
      "disputes/[id]/triage/route.ts",
      "disputes/[id]/escalate/route.ts",
      "disputes/[id]/resolve/route.ts",
      "disputes/[id]/close/route.ts"
    ]) {
      const routePath = `app/api/admin/governance/${endpoint}`;
      assert.ok(routeFiles.includes(routePath), `${routePath} should exist`);
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /adminService\./);
      assert.doesNotMatch(route, /governanceRepository|historicalAuthorityRepository/);
    }
  });

  it("exposes read-only Governance operations through admin-authenticated service APIs and UI", () => {
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const operationsService = readFileSync("src/server/services/governance-operations-service.ts", "utf8");
    const operationsRoute = readFileSync("app/api/admin/governance/operations/route.ts", "utf8");
    const dashboard = readFileSync("components/admin/AdminDashboard.tsx", "utf8");
    const tabs = readFileSync("components/admin/AdminTabs.tsx", "utf8");
    const governanceUi = readFileSync("components/admin/AdminGovernance.tsx", "utf8");

    assert.match(adminService, /getGovernanceOperationsSnapshot: governanceOperationsService\.getSnapshot/);
    assert.match(operationsService, /governanceRepository\.listPublicationPackages/);
    assert.match(operationsService, /governanceRepository\.listDecisions/);
    assert.match(operationsService, /governanceRepository\.listFeedbackPackages/);
    assert.match(operationsService, /governanceRepository\.listAuditRecords/);
    assert.match(operationsService, /historicalLibraryRepository\.listRevisions/);
    assert.match(operationsService, /historicalLibraryRepository\.listMerges/);
    assert.match(operationsRoute, /withAdminAuth/);
    assert.match(operationsRoute, /adminService\.getGovernanceOperationsSnapshot/);
    assert.doesNotMatch(operationsRoute, /governanceRepository|historicalLibraryRepository|getWriteSql/);

    assert.match(tabs, /"governance"/);
    assert.match(dashboard, /<AdminGovernance/);
    assert.match(governanceUi, /\/api\/admin\/governance\/operations/);
    assert.match(governanceUi, /Publication Packages/);
    assert.match(governanceUi, /Continuity/);
    assert.match(governanceUi, /Audit/);
    assert.match(governanceUi, /factoryPackageVersionId/);
    assert.match(governanceUi, /sourcePublishedRecordId/);
    assert.doesNotMatch(governanceUi, /governanceRepository|historicalLibraryRepository|factoryRepository|getWriteSql/);
    assert.doesNotMatch(governanceUi, /fetch\(["']\/api\/admin\/governance\/.*(approve|reject|publish|submit|resolve|close)/);
  });
});

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
