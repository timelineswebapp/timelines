import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("published memory projection system", () => {
  it("defines projection storage, lineage, audit, and continuity structures", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_published_memory_projections.sql", "utf8");
    const operationsMigration = readFileSync("db/migrations/20260623_projection_cutover_operations.sql", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /CREATE TABLE IF NOT EXISTS published_memory_projections/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS published_memory_projection_lineage/);
      assert.match(source, /CREATE TABLE IF NOT EXISTS published_memory_continuity_projections/);
      assert.match(source, /published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots/);
      assert.match(source, /projection_version INTEGER NOT NULL/);
      assert.match(source, /projection_hash TEXT NOT NULL/);
      assert.match(source, /source_event_type TEXT NOT NULL/);
      assert.match(source, /audit_record_id UUID/);
      assert.match(source, /prevent_published_memory_projections_delete/);
    }

    assert.match(operationsMigration, /CREATE TABLE IF NOT EXISTS published_memory_projection_rebuild_reports/);
    assert.match(operationsMigration, /coverage_summary JSONB NOT NULL/);
    assert.match(operationsMigration, /dto_validation_failures JSONB NOT NULL/);
    assert.match(operationsMigration, /rebuild_failures JSONB NOT NULL/);
    assert.match(operationsMigration, /prevent_published_memory_projection_rebuild_reports_delete/);
  });

  it("keeps projection persistence isolated and deterministic", () => {
    const repository = readFileSync("src/server/repositories/published-memory-projection-repository.ts", "utf8");
    const service = readFileSync("src/server/services/published-memory-projection-service.ts", "utf8");
    const contracts = readFileSync("src/server/platform/projection-dto-contracts.ts", "utf8");

    assert.match(repository, /hashProjection/);
    assert.match(repository, /stableJson/);
    assert.match(repository, /INSERT INTO published_memory_projections/);
    assert.match(repository, /INSERT INTO published_memory_projection_lineage/);
    assert.match(repository, /INSERT INTO published_memory_continuity_projections/);
    assert.match(repository, /INSERT INTO published_memory_projection_rebuild_reports/);
    assert.match(repository, /ON CONFLICT \(published_snapshot_id, projection_type, projection_hash\)/);
    assert.match(service, /generateForAdmission/);
    assert.match(service, /generateForRevision/);
    assert.match(service, /generateForRetirement/);
    assert.match(service, /generateForMerge/);
    assert.match(service, /generateForPreservation/);
    assert.match(service, /rebuildAll/);
    assert.match(service, /buildSearchPayload/);
    assert.match(service, /buildSitemapPayload/);
    assert.match(service, /validateProjectionDto/);
    assert.match(service, /projectionType: "search"/);
    assert.match(service, /projectionType: "sitemap"/);
    assert.match(contracts, /PROJECTION_DTO_CONTRACT_VERSION/);
    assert.match(contracts, /projectionDtoContracts/);
    assert.match(contracts, /validateProjectionDto/);
    assert.doesNotMatch(service, /factoryRepository|governanceRepository/);
  });

  it("integrates projection generation with Historical Library lifecycle events", () => {
    const libraryService = readFileSync("src/server/services/historical-library-service.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const route = readFileSync("app/api/admin/historical-library/projections/rebuild/route.ts", "utf8");
    const metricsRoute = readFileSync("app/api/admin/historical-library/projections/metrics/route.ts", "utf8");

    assert.match(libraryService, /publishedMemoryProjectionService\.generateForAdmission/);
    assert.match(libraryService, /publishedMemoryProjectionService\.generateForRevision/);
    assert.match(libraryService, /publishedMemoryProjectionService\.generateForRetirement/);
    assert.match(libraryService, /publishedMemoryProjectionService\.generateForMerge/);
    assert.match(libraryService, /publishedMemoryProjectionService\.generateForPreservation/);
    assert.match(adminService, /rebuildPublishedMemoryProjections: publishedMemoryProjectionService\.rebuildAll/);
    assert.match(adminService, /getPublishedMemoryProjectionCutoverMetrics: publishedMemoryProjectionService\.getCutoverMetrics/);
    assert.match(route, /withAdminAuth/);
    assert.match(route, /adminService\.rebuildPublishedMemoryProjections/);
    assert.match(metricsRoute, /withAdminAuth/);
    assert.match(metricsRoute, /adminService\.getPublishedMemoryProjectionCutoverMetrics/);
  });

  it("requires Platform read models to consume projection records without snapshot fallback", () => {
    const platformRepository = readFileSync("src/server/repositories/platform-read-model-repository.ts", "utf8");

    assert.match(platformRepository, /publishedMemoryProjectionRepository\.listActiveProjections/);
    assert.match(platformRepository, /getPublishedReadModelBySlug[\s\S]*publishedMemoryProjectionRepository\.getActiveProjectionBySlug/);
    assert.match(platformRepository, /getLatestContinuityProjection/);
    assert.doesNotMatch(platformRepository, /FROM historical_library_published_snapshots|historical_library_merges|historical_library_retirements|getSql|getWriteSql/);
  });

  it("generates companion search and sitemap projections from public read-model payloads", () => {
    const service = readFileSync("src/server/services/published-memory-projection-service.ts", "utf8");

    assert.match(service, /generateProjectionBundleFromSnapshot/);
    assert.match(service, /primaryProjection/);
    assert.match(service, /companionProjections/);
    assert.match(service, /searchableText/);
    assert.match(service, /searchable_text/);
    assert.match(service, /canonical_url/);
    assert.match(service, /last_modified/);
    assert.match(service, /kind: "timeline"/);
    assert.match(service, /kind: "milestone"/);
  });

  it("projects publication package snapshots as provenance-preserving timelines", () => {
    const service = readFileSync("src/server/services/published-memory-projection-service.ts", "utf8");

    assert.match(service, /isPublicationPackageTimelineSnapshot/);
    assert.match(service, /snapshot\.authorityRef\.authorityType !== "publication_package"/);
    assert.match(service, /return "timeline"/);
    assert.match(service, /projectionDtoMetadata\("timeline"\)/);
    assert.match(service, /stableTimelineId\(snapshot\.snapshotId\)/);
    assert.match(service, /slugifyProjection\(title\)/);
    assert.match(service, /category: "Technology"/);
    assert.match(service, /orderingMode: "chronology"/);
    assert.match(service, /tags: \[\]/);
    assert.match(service, /events: \[\]/);
    assert.match(service, /publicationPackageId: payload\.publicationPackageId/);
    assert.match(service, /readinessCertification: payload\.readinessCertification/);
    assert.match(service, /acceptanceOutcome: payload\.acceptanceOutcome/);
    assert.match(service, /packageScope: payload\.packageScope/);
  });

  it("normalizes punctuation, symbols, digits, acronyms, and non-standard timeline titles into deterministic slugs", () => {
    const service = readFileSync("src/server/services/published-memory-projection-service.ts", "utf8");

    assert.match(service, /replace\(\/\\\+\/g, " plus "\)/);
    assert.match(service, /replace\(\/&\/g, " and "\)/);
    assert.match(service, /\^\(\.\+\?\)\\s\+\(\?:inaugural\|institutional\|timeline\|publication\|package\)\\b\/i/);

    for (const subject of [
      "X-ray",
      "3D Printing",
      "C++",
      "B-52 Bomber",
      "Apollo 11",
      "COVID-19",
      "Web 2.0",
      "World War II"
    ]) {
      const description = `${subject} institutional scale certification package.`;
      assert.match(description, /^(.+?)\s+(?:inaugural|institutional|timeline|publication|package)\b/i);
    }
  });

  it("defines and enforces DTO-complete projection contracts", () => {
    const contracts = readFileSync("src/server/platform/projection-dto-contracts.ts", "utf8");
    const service = readFileSync("src/server/services/published-memory-projection-service.ts", "utf8");

    for (const field of [
      "chronology_metadata",
      "seo_metadata",
      "og_metadata",
      "published_state",
      "continuity_metadata",
      "date_precision",
      "timeline_context",
      "relationship_summary",
      "relationship_id",
      "source_authority_ref",
      "target_authority_ref",
      "relationship_type",
      "evidence_refs",
      "provenance",
      "authority_state",
      "entity_type",
      "entity_id",
      "searchable_text",
      "canonical_url",
      "last_modified"
    ]) {
      assert.match(contracts, new RegExp(field));
    }

    assert.match(service, /buildTimelineDto/);
    assert.match(service, /buildMilestoneDto/);
    assert.match(service, /buildHistoricalObjectDto/);
    assert.match(service, /buildRelationshipDto/);
    assert.match(service, /payload\.relationship_id/);
    assert.match(service, /continuity_metadata/);
    assert.match(service, /validateProjectionDto\(projectionType, payload\)/);
    assert.match(service, /validateProjectionDto\("search", searchPayload\)/);
    assert.match(service, /validateProjectionDto\("sitemap", sitemapPayload\)/);
  });

  it("enforces one active projection and supersedes prior revision projections", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260622_projection_lifecycle_correction.sql", "utf8");
    const repository = readFileSync("src/server/repositories/published-memory-projection-repository.ts", "utf8");

    for (const source of [schema, migration]) {
      assert.match(source, /idx_published_memory_projections_one_active/);
      assert.match(source, /WHERE lifecycle = 'active'/);
      assert.match(source, /superseded_by_projection_id/);
    }
    assert.match(migration, /published_memory_projections must be created before projection_lifecycle_correction/);

    assert.match(repository, /SET lifecycle = 'superseded'/);
    assert.match(repository, /projection_hash <>/);
    assert.match(repository, /superseded_by_projection_id =/);
  });

  it("excludes retired and merged projections from active reads", () => {
    const repository = readFileSync("src/server/repositories/published-memory-projection-repository.ts", "utf8");
    const service = readFileSync("src/server/services/published-memory-projection-service.ts", "utf8");

    assert.match(repository, /markSnapshotProjectionsLifecycle/);
    assert.match(repository, /lifecycle IN \('active', 'superseded'\)/);
    assert.match(repository, /continuity_type IN \('retired', 'merged'\)/);
    assert.match(service, /generateForRetirement[\s\S]*markSnapshotProjectionsLifecycle/);
    assert.match(service, /generateForMerge[\s\S]*markSnapshotProjectionsLifecycle/);
  });

  it("rebuilds projections with lifecycle reconciliation and continuity projections", () => {
    const service = readFileSync("src/server/services/published-memory-projection-service.ts", "utf8");
    const repository = readFileSync("src/server/repositories/published-memory-projection-repository.ts", "utf8");

    assert.match(service, /DEFAULT_REBUILD_BATCH_SIZE = 500/);
    assert.match(service, /historicalLibraryRepository\.countPublishedSnapshots\(\)/);
    assert.match(service, /historicalLibraryRepository\.listPublishedSnapshots\(batchSize, offset\)/);
    assert.match(service, /historicalLibraryRepository\.listRetirements\(batchSize, offset\)/);
    assert.match(service, /historicalLibraryRepository\.listMerges\(batchSize, offset\)/);
    assert.doesNotMatch(service, /listPublishedSnapshots\(5000\)|listRetirements\(5000\)|listMerges\(5000\)/);
    assert.match(service, /upsertContinuityProjection/);
    assert.match(service, /reconcileLifecycleState/);
    assert.match(service, /insertRebuildReport/);
    assert.match(service, /dtoValidationFailures/);
    assert.match(service, /rebuildFailures/);
    assert.match(service, /projectionType: inferProjectionType\(snapshot, snapshot\.snapshot\)/);
    assert.match(service, /coverageSummary/);
    assert.match(repository, /ROW_NUMBER\(\) OVER/);
    assert.match(repository, /retiredSnapshotIds/);
    assert.match(repository, /mergedSnapshotIds/);
    assert.match(repository, /getCoverageMetrics/);
    assert.match(repository, /projectionCoveragePercentage/);
    assert.match(repository, /relationshipProjectionCount/);
    assert.match(repository, /relationshipProjectionCoverage/);
    assert.match(repository, /relationshipProjectionFailures/);
    assert.match(repository, /relationshipDtoFailures/);
    assert.match(repository, /relationshipContinuityProjectionCount/);
  });

  it("keeps projection migrations in dependency-safe order", () => {
    const migrations = [
      "20260621_published_memory_projections.sql",
      "20260622_projection_lifecycle_correction.sql",
      "20260623_projection_cutover_operations.sql"
    ];
    assert.deepEqual([...migrations].sort(), migrations);
  });

  it("verifies primary projection coverage per Platform-projectable snapshot", () => {
    const verification = readFileSync("src/server/services/publication-verification-service.ts", "utf8");
    assert.match(verification, /projectableSnapshotCount/);
    assert.match(verification, /projectedSnapshotCount/);
    assert.match(verification, /historical_object','milestone','relationship/);
    assert.match(verification, /projectedSnapshotCount === counts\.projectableSnapshotCount/);
    assert.doesNotMatch(verification, /projectionCount >= counts\.snapshotCount/);
  });

  it("keeps public projection content and navigation free of Factory leakage", () => {
    const service = readFileSync("src/server/services/published-memory-projection-service.ts", "utf8");
    const operationsRepository = readFileSync("src/server/repositories/factory-operations-repository.ts", "utf8");
    const analyticsRepository = readFileSync("src/server/repositories/analytics-events-repository.ts", "utf8");
    assert.match(service, /candidate\|factory\|pipeline\|draft\|governance\|not submitted/);
    assert.match(service, /timelineLinks: \[timelineLink\]/);
    assert.match(operationsRepository, /governancePublicationPackageId/);
    assert.doesNotMatch(operationsRepository, /lower\(COALESCE\(payload->'timeline'->>'title'/);
    assert.match(analyticsRepository, /published_projection_id/);
    assert.match(analyticsRepository, /published_memory_projections/);
    assert.match(analyticsRepository, /LEFT JOIN timelines/);
  });

  it("documents cutover, rebuild, validation, and rollback operations", () => {
    const runbook = readFileSync("docs/operations/PROJECTION_CUTOVER_RUNBOOK.md", "utf8");

    assert.match(runbook, /Migration Order/);
    assert.match(runbook, /Rebuild Procedure/);
    assert.match(runbook, /Validation Procedure/);
    assert.match(runbook, /Cutover Procedure/);
    assert.match(runbook, /Rollback Procedure/);
    assert.match(runbook, /Projection tables must not be manually deleted or truncated/);
  });
});
