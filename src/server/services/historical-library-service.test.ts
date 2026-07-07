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
    assert.match(repository, /buildPublishedMemorySnapshotPayload/);
    assert.match(repository, /publicationPackage\.canonicalAuthority/);
    assert.match(repository, /CANONICAL_AUTHORITY_PAYLOAD_MISSING/);
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

  it("hydrates every canonical authority payload from the approved publication package", () => {
    const repository = readFileSync("src/server/repositories/historical-library-repository.ts", "utf8");

    assert.match(repository, /canonicalAuthority = \(input\.publicationPackage\.canonicalAuthority \|\| \[\]\)\.find/);
    assert.match(repository, /factoryObjectId: canonicalAuthority\.factoryObjectId/);
    assert.match(repository, /governanceDecisionRefs: input\.publicationPackage\.decisionRefs/);
    assert.match(repository, /validationArtifacts: input\.publicationPackage\.validationArtifacts/);
    assert.match(repository, /snapshotHash: hashSnapshot\(snapshot\)/);
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
    assert.match(service, /expectedDecisionTypes: \["REVISE_HISTORICAL_OBJECT", "REVISE_PARTICIPATION", "REVISE_RELATIONSHIP"\]/);
    assert.match(service, /expectedDecisionTypes: \["RETIRE_HISTORICAL_OBJECT", "RETIRE_PARTICIPATION", "RETIRE_RELATIONSHIP"\]/);
    assert.match(service, /expectedDecisionTypes: \["MERGE_HISTORICAL_OBJECT", "MERGE_RELATIONSHIP"\]/);
    assert.match(service, /expectedDecisionTypes: \["PRESERVE_HISTORICAL_OBJECT", "PRESERVE_RELATIONSHIP"\]/);
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

  it("completes immutable withdrawal, split, and explicit supersession lifecycles", () => {
    const service = readFileSync("src/server/services/historical-library-service.ts", "utf8");
    const repository = readFileSync("src/server/repositories/historical-library-repository.ts", "utf8");
    const migration = readFileSync("db/migrations/20260724_historical_library_institutional_completion.sql", "utf8");
    const rollback = readFileSync("db/rollbacks/20260724_historical_library_institutional_completion.sql", "utf8");

    for (const operation of ["withdrawPublishedMemory", "splitPublishedMemory", "supersedePublishedMemory"]) {
      assert.match(service, new RegExp(operation));
    }
    for (const operation of ["createWithdrawal", "createSplit", "createSupersession", "getContinuityByAuthorityId"]) {
      assert.match(repository, new RegExp(operation));
    }
    for (const decision of [
      "WITHDRAW_HISTORICAL_OBJECT", "SPLIT_HISTORICAL_OBJECT", "SUPERSEDE_HISTORICAL_OBJECT",
      "WITHDRAW_RELATIONSHIP", "SPLIT_RELATIONSHIP", "SUPERSEDE_RELATIONSHIP"
    ]) assert.match(service, new RegExp(decision));
    assert.match(service, /Split requires at least two distinct child authority records/);
    assert.match(service, /Every split child requires immutable redirect metadata/);
    assert.match(service, /Supersession must preserve authority type/);
    assert.match(migration, /historical_library_withdrawals/);
    assert.match(migration, /historical_library_splits/);
    assert.match(migration, /historical_library_split_children/);
    assert.match(migration, /historical_library_supersessions/);
    assert.match(rollback, /DROP TABLE IF EXISTS historical_library_withdrawals/);
  });

  it("enforces canonical uniqueness, immutable admissions, continuity, and lifecycle audit", () => {
    const migration = readFileSync("db/migrations/20260724_historical_library_institutional_completion.sql", "utf8");
    const repository = readFileSync("src/server/repositories/historical-library-repository.ts", "utf8");
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_historical_library_canonical_authority/);
    assert.match(migration, /prevent_historical_library_admissions_update/);
    assert.match(migration, /historical_library_continuity_edges/);
    assert.match(migration, /historical_library_lifecycle_audit/);
    assert.match(migration, /BEFORE UPDATE OR DELETE/);
    assert.match(migration, /record_historical_library_revision_lifecycle/);
    assert.match(migration, /record_historical_library_retirement_lifecycle/);
    assert.match(migration, /record_historical_library_merge_lifecycle/);
    assert.match(migration, /record_historical_library_preservation_lifecycle/);
    assert.match(repository, /withdrawing|creating historical library withdrawal/i);
    assert.match(repository, /ON CONFLICT \(previous_published_record_id\) DO NOTHING/);
    assert.match(repository, /LIMIT \$\{Math\.min\(Math\.max\(limit, 1\), 200\)\}/);
  });

  it("exposes new lifecycle mutations only through validated admin service routes", () => {
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const routePaths = [
      "app/api/admin/historical-library/published-snapshots/[id]/withdrawals/route.ts",
      "app/api/admin/historical-library/published-snapshots/[id]/splits/route.ts",
      "app/api/admin/historical-library/published-snapshots/[id]/supersessions/route.ts"
    ];
    for (const method of ["withdrawPublishedMemory", "splitPublishedMemory", "supersedePublishedMemory"]) {
      assert.match(adminService, new RegExp(`${method}: historicalLibraryService\\.${method}`));
    }
    for (const routePath of routePaths) {
      const route = readFileSync(routePath, "utf8");
      assert.match(route, /withAdminAuth/);
      assert.match(route, /roles: \["library_operator"\]/);
      assert.match(route, /Schema\.parse\(await request\.json\(\)\)/);
      assert.doesNotMatch(route, /Repository|getWriteSql|INSERT INTO|UPDATE |DELETE FROM/);
    }
  });
});
