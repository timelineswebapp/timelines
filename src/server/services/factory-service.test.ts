import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ApiError } from "@/src/server/api/responses";
import {
  assertFactoryCannotAdmitToHistoricalLibrary,
  assertFactoryCannotApprovePackage,
  assertFactoryCannotCertifyReadiness,
  assertFactoryCannotPublish,
  assertFactoryCannotRejectPackage
} from "@/src/server/services/factory-service";

describe("factory production memory foundation", () => {
  it("defines Factory-owned Production Memory schema with preservation and immutability", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_factory_production_memory.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_objects/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_artifacts/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_package_drafts/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_package_versions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_audit_records/);
      assert.match(source, /prevent_factory_history_delete/);
      assert.match(source, /prevent_submitted_factory_package_version_update/);
      assert.match(source, /Submitted Factory package versions are immutable/);
    }
  });

  it("defines Factory feedback consumption and revision planning schema with preservation", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_factory_feedback_consumption.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_feedback_consumptions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS factory_revision_plans/);
      assert.match(source, /feedback_package_id UUID NOT NULL/);
      assert.match(source, /governance_publication_package_id UUID/);
      assert.match(source, /factory_package_version_id UUID/);
      assert.match(source, /factory_package_draft_id UUID/);
      assert.match(source, /factory_lineage_root_id UUID/);
      assert.match(source, /affected_factory_object_ids JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
      assert.match(source, /revision_plan_id UUID/);
      assert.match(source, /resolution_record_id UUID/);
      assert.match(source, /audit_record_id UUID NOT NULL REFERENCES factory_audit_records/);
      assert.match(source, /prevent_factory_feedback_consumptions_delete/);
      assert.match(source, /prevent_factory_revision_plans_delete/);
    }
  });

  it("defines Factory resubmission workflow linkage with deterministic lineage and supersession", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_factory_resubmission_workflow.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /revision_plan_id UUID REFERENCES factory_revision_plans/);
      assert.match(source, /source_feedback_package_id UUID REFERENCES governance_feedback_packages/);
      assert.match(source, /resubmission_audit_record_id UUID REFERENCES factory_audit_records/);
      assert.match(source, /superseded_package_version_id UUID REFERENCES factory_package_versions/);
      assert.match(source, /new_package_version_id UUID UNIQUE REFERENCES factory_package_versions/);
      assert.match(source, /governance_publication_package_id UUID REFERENCES governance_publication_packages/);
      assert.match(source, /submission_audit_record_id UUID REFERENCES factory_audit_records/);
      assert.match(source, /revision_completion_record_id UUID REFERENCES factory_audit_records/);
      assert.match(source, /CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_package_versions_revision_plan/);
    }
  });

  it("keeps Factory database access isolated to the repository layer", () => {
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const route = readFileSync("app/api/admin/factory/objects/route.ts", "utf8");

    assert.match(repository, /getWriteSql\("creating factory object"\)/);
    assert.match(repository, /INSERT INTO factory_objects/);
    assert.match(repository, /INSERT INTO factory_artifacts/);
    assert.match(repository, /INSERT INTO factory_package_drafts/);
    assert.match(repository, /INSERT INTO factory_package_versions/);
    assert.match(repository, /INSERT INTO factory_feedback_consumptions/);
    assert.match(repository, /INSERT INTO factory_revision_plans/);
    assert.doesNotMatch(service, /INSERT INTO|UPDATE factory_|DELETE FROM factory_|getWriteSql/);
    assert.doesNotMatch(route, /factoryRepository|getWriteSql|INSERT INTO|UPDATE|DELETE FROM/);
  });

  it("blocks Factory from Governance certification and approval responsibilities", () => {
    assert.throws(() => assertFactoryCannotCertifyReadiness(), ApiError);
    assert.throws(() => assertFactoryCannotApprovePackage(), ApiError);
    assert.throws(() => assertFactoryCannotRejectPackage(), ApiError);
  });

  it("blocks Factory from Historical Library admission and public publication", () => {
    assert.throws(() => assertFactoryCannotAdmitToHistoricalLibrary(), ApiError);
    assert.throws(() => assertFactoryCannotPublish(), ApiError);
  });

  it("exposes only admin-authenticated Factory routes through adminService", () => {
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const routes = [
      "app/api/admin/factory/objects/route.ts",
      "app/api/admin/factory/objects/[id]/transition/route.ts",
      "app/api/admin/factory/artifacts/route.ts",
      "app/api/admin/factory/package-drafts/route.ts",
      "app/api/admin/factory/package-drafts/[id]/transition/route.ts",
      "app/api/admin/factory/package-drafts/[id]/versions/route.ts",
      "app/api/admin/factory/package-versions/[id]/submit/route.ts",
      "app/api/admin/factory/feedback/intake/route.ts",
      "app/api/admin/factory/feedback/[id]/transition/route.ts",
      "app/api/admin/factory/feedback/[id]/revision-plan/route.ts",
      "app/api/admin/factory/revision-plans/[id]/prepare-resubmission/route.ts",
      "app/api/admin/factory/revision-plans/[id]/complete-resubmission/route.ts"
    ];

    for (const routePath of routes) {
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /adminService\./);
      assert.doesNotMatch(route, /factoryRepository|governanceRepository|historicalLibraryRepository/);
    }

    for (const method of [
      "createFactoryObject",
      "transitionFactoryObject",
      "createFactoryArtifact",
      "createFactoryPackageDraft",
      "transitionFactoryPackageDraft",
      "createFactoryPackageVersion",
      "markFactoryPackageVersionSubmitted",
      "intakeFactoryFeedback",
      "transitionFactoryFeedback",
      "createFactoryRevisionPlan",
      "prepareFactoryResubmission",
      "completeFactoryResubmission"
    ]) {
      assert.match(adminService, new RegExp(`${method}: factoryService\\.`));
    }
  });

  it("implements Factory feedback intake, revision planning, and resubmission preparation without public publication authority", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");
    const validation = readFileSync("src/server/validation/schemas.ts", "utf8");

    assert.match(service, /intakeFeedbackPackage/);
    assert.match(service, /getFeedbackPackage/);
    assert.match(service, /getGovernanceSubmissionByGovernancePackage/);
    assert.match(service, /transitionFeedbackConsumption/);
    assert.match(service, /createRevisionPlan/);
    assert.match(service, /prepareResubmission/);
    assert.match(service, /completeResubmission/);
    assert.match(service, /supersedesPackageId: sourceDraft\.packageDraftId/);
    assert.match(service, /supersedesVersionId: supersededVersion\.packageVersionId/);
    assert.match(service, /markPackageVersionSubmitted/);
    assert.match(service, /completeRevisionPlan/);
    assert.match(repository, /getFeedbackConsumptionByFeedbackPackage/);
    assert.match(repository, /createFeedbackConsumption/);
    assert.match(repository, /transitionRevisionPlan/);
    assert.match(repository, /revision_plan_id/);
    assert.match(repository, /source_feedback_package_id/);
    assert.match(repository, /completeRevisionPlan/);
    assert.match(validation, /factoryFeedbackIntakeSchema/);
    assert.match(validation, /factoryFeedbackTransitionSchema/);
    assert.match(validation, /factoryRevisionPlanSchema/);
    assert.match(validation, /factoryResubmissionPreparationSchema/);
    assert.match(validation, /factoryResubmissionCompletionSchema/);
    assert.doesNotMatch(service, /historicalLibraryService|admitPublicationPackage|publishPublicationPackage/);
  });

  it("implements Governance submission bridge without certification or admission", () => {
    const service = readFileSync("src/server/services/factory-service.ts", "utf8");
    const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");
    const governanceRepository = readFileSync("src/server/repositories/governance-repository.ts", "utf8");
    const route = readFileSync("app/api/admin/factory/package-versions/[id]/submit/route.ts", "utf8");

    assert.match(service, /getGovernanceSubmissionByVersion/);
    assert.match(service, /governanceService\.createPublicationPackage/);
    assert.match(service, /markPackageVersionSubmitted/);
    assert.match(repository, /CREATE TABLE IF NOT EXISTS factory_governance_submissions|factory_governance_submissions/);
    assert.match(governanceRepository, /factory_package_version_id/);
    assert.match(governanceRepository, /factorySubmission/);
    assert.match(route, /factoryGovernanceSubmissionSchema\.parse/);
    assert.doesNotMatch(repository, /historical_library_admissions|historical_library_published_snapshots|governance_publication_packages\s*\(/);
    assert.doesNotMatch(service, /certifyReadiness\(input|approveDecision|rejectDecision|admitPublicationPackage/);
  });
});
