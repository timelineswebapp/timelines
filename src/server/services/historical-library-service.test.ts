import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ApiError } from "@/src/server/api/responses";
import type { GovernanceServiceBoundary } from "@/src/server/governance/contracts";

describe("historical library backend foundation", () => {
  it("defines Published Memory tables with no-delete and immutable snapshot enforcement", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_historical_library_foundation.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_library_admissions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_library_published_snapshots/);
      assert.match(source, /publication_package_id UUID NOT NULL UNIQUE REFERENCES governance_publication_packages/);
      assert.match(source, /governance_decision_id UUID NOT NULL REFERENCES governance_decisions/);
      assert.match(source, /prevent_historical_library_admissions_delete/);
      assert.match(source, /prevent_historical_library_published_snapshots_update/);
      assert.match(source, /prevent_historical_library_published_snapshots_delete/);
    }
  });

  it("defines append-only Published Memory lifecycle structures", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_historical_library_lifecycle.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_library_published_revisions/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_library_retirements/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_library_merges/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_library_preservations/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS historical_library_feedback_links/);
      assert.match(source, /published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots/);
      assert.match(source, /source_published_record_id UUID NOT NULL REFERENCES historical_library_published_snapshots/);
      assert.match(source, /target_published_record_id UUID NOT NULL REFERENCES historical_library_published_snapshots/);
      assert.match(source, /feedback_package_id UUID NOT NULL UNIQUE REFERENCES governance_feedback_packages/);
      assert.match(source, /prevent_historical_library_revisions_delete/);
      assert.match(source, /prevent_historical_library_retirements_delete/);
      assert.match(source, /prevent_historical_library_merges_delete/);
      assert.match(source, /prevent_historical_library_preservations_delete/);
      assert.match(source, /prevent_historical_library_feedback_links_delete/);
    }
  });

  it("keeps Published Memory database access inside the Historical Library repository", () => {
    const repository = readFileSync("src/server/repositories/historical-library-repository.ts", "utf8");
    const service = readFileSync("src/server/services/historical-library-service.ts", "utf8");
    const route = readFileSync("app/api/admin/historical-library/admissions/[packageId]/route.ts", "utf8");

    assert.match(repository, /getWriteSql\("creating historical library admission"\)/);
    assert.match(repository, /INSERT INTO historical_library_admissions/);
    assert.match(repository, /INSERT INTO historical_library_published_snapshots/);
    assert.match(repository, /INSERT INTO historical_library_published_revisions/);
    assert.match(repository, /INSERT INTO historical_library_retirements/);
    assert.match(repository, /INSERT INTO historical_library_merges/);
    assert.match(repository, /INSERT INTO historical_library_preservations/);
    assert.match(repository, /INSERT INTO historical_library_feedback_links/);
    assert.doesNotMatch(service, /INSERT INTO|UPDATE historical_library|DELETE FROM historical_library|getWriteSql/);
    assert.doesNotMatch(route, /historicalLibraryRepository|governanceRepository|getWriteSql|INSERT INTO|UPDATE|DELETE FROM/);
  });

  it("requires Governance-certified accepted packages and approved decisions before admission", () => {
    const service = readFileSync("src/server/services/historical-library-service.ts", "utf8");

    assert.match(service, /getPublicationPackage\(input\.packageId\)/);
    assert.match(service, /readinessCertification\.readinessStatus !== "ready"/);
    assert.match(service, /publicationPackage\.lifecycle !== "accepted" && publicationPackage\.lifecycle !== "published"/);
    assert.match(service, /acceptanceOutcome !== "accepted" && publicationPackage\.acceptanceOutcome !== "accepted_with_notes"/);
    assert.match(service, /verifyApprovedGovernanceDecision\(\{/);
    assert.match(service, /expectedDecisionTypes: \["ACCEPT_PUBLICATION_PACKAGE"\]/);
    assert.match(service, /expectedAuthorityType: "publication_package"/);
    assert.match(service, /expectedAuthorityId: input\.packageId/);
  });

  it("blocks Factory and Platform admission paths", async () => {
    const { historicalLibraryService } = await import("@/src/server/services/historical-library-service");
    const baseInput = {
      packageId: "123e4567-e89b-12d3-a456-426614174000",
      governanceDecisionId: "123e4567-e89b-12d3-a456-426614174001",
      actor: {
        actorId: "library-editor",
        role: "library_editor" as const,
        institutionId: "timelines-library"
      },
      reason: "Admit Governance-certified package."
    };

    for (const requestedByService of ["factory", "platform"] satisfies GovernanceServiceBoundary[]) {
      await assert.rejects(
        () => historicalLibraryService.admitPublicationPackage({ ...baseInput, requestedByService }),
        ApiError
      );
    }
  });

  it("exposes only an admin-authenticated admission route through adminService", () => {
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const routes = [
      "app/api/admin/historical-library/admissions/[packageId]/route.ts",
      "app/api/admin/historical-library/published-snapshots/[id]/revisions/route.ts",
      "app/api/admin/historical-library/published-snapshots/[id]/retirements/route.ts",
      "app/api/admin/historical-library/published-snapshots/[id]/merge/route.ts",
      "app/api/admin/historical-library/published-snapshots/[id]/preservations/route.ts",
      "app/api/admin/historical-library/feedback-packages/route.ts"
    ];

    assert.match(adminService, /admitPublicationPackageToHistoricalLibrary: historicalLibraryService\.admitPublicationPackage/);
    assert.match(adminService, /revisePublishedMemory: historicalLibraryService\.revisePublishedMemory/);
    assert.match(adminService, /retirePublishedMemory: historicalLibraryService\.retirePublishedMemory/);
    assert.match(adminService, /mergePublishedMemory: historicalLibraryService\.mergePublishedMemory/);
    assert.match(adminService, /preservePublishedMemory: historicalLibraryService\.preservePublishedMemory/);
    assert.match(adminService, /generateHistoricalLibraryFeedbackPackage: historicalLibraryService\.generateFeedbackPackage/);
    for (const routePath of routes) {
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /adminService\./);
      assert.doesNotMatch(route, /historicalLibraryRepository|governanceRepository|getWriteSql|INSERT INTO|UPDATE|DELETE FROM/);
    }
  });

  it("implements lifecycle orchestration with Governance verification and feedback generation", () => {
    const service = readFileSync("src/server/services/historical-library-service.ts", "utf8");
    const validation = readFileSync("src/server/validation/schemas.ts", "utf8");

    assert.match(service, /revisePublishedMemory/);
    assert.match(service, /retirePublishedMemory/);
    assert.match(service, /mergePublishedMemory/);
    assert.match(service, /preservePublishedMemory/);
    assert.match(service, /generateFeedbackPackage/);
    assert.match(service, /verifyApprovedGovernanceDecision/);
    assert.match(service, /expectedDecisionTypes: \["REVISE_HISTORICAL_OBJECT", "REVISE_PARTICIPATION"\]/);
    assert.match(service, /expectedDecisionTypes: \["RETIRE_HISTORICAL_OBJECT", "RETIRE_PARTICIPATION"\]/);
    assert.match(service, /expectedDecisionTypes: \["MERGE_HISTORICAL_OBJECT"\]/);
    assert.match(service, /expectedDecisionTypes: \["PRESERVE_HISTORICAL_OBJECT"\]/);
    assert.match(service, /expectedDecisionTypes: \["CREATE_FEEDBACK_PACKAGE"\]/);
    assert.match(service, /governanceService\.createFeedbackPackage/);
    assert.match(service, /historicalLibraryRepository\.createFeedbackLink/);
    assert.doesNotMatch(service, /factoryService|factoryRepository|publishPublicationPackage|transitionPublicationPackage/);
    assert.match(validation, /historicalLibraryRevisionSchema/);
    assert.match(validation, /historicalLibraryRetirementSchema/);
    assert.match(validation, /historicalLibraryMergeSchema/);
    assert.match(validation, /historicalLibraryPreservationSchema/);
    assert.match(validation, /historicalLibraryFeedbackGenerationSchema/);
  });
});
