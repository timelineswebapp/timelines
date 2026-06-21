import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("published memory projection system", () => {
  it("defines projection storage, lineage, audit, and continuity structures", () => {
    const schema = readFileSync("db/schema.sql", "utf8");
    const migration = readFileSync("db/migrations/20260621_published_memory_projections.sql", "utf8");

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
  });

  it("keeps projection persistence isolated and deterministic", () => {
    const repository = readFileSync("src/server/repositories/published-memory-projection-repository.ts", "utf8");
    const service = readFileSync("src/server/services/published-memory-projection-service.ts", "utf8");

    assert.match(repository, /hashProjection/);
    assert.match(repository, /stableJson/);
    assert.match(repository, /INSERT INTO published_memory_projections/);
    assert.match(repository, /INSERT INTO published_memory_projection_lineage/);
    assert.match(repository, /INSERT INTO published_memory_continuity_projections/);
    assert.match(repository, /ON CONFLICT \(published_snapshot_id, projection_type, projection_hash\)/);
    assert.match(service, /generateForAdmission/);
    assert.match(service, /generateForRevision/);
    assert.match(service, /generateForRetirement/);
    assert.match(service, /generateForMerge/);
    assert.match(service, /generateForPreservation/);
    assert.match(service, /rebuildAll/);
    assert.doesNotMatch(service, /factoryRepository|governanceRepository/);
  });

  it("integrates projection generation with Historical Library lifecycle events", () => {
    const libraryService = readFileSync("src/server/services/historical-library-service.ts", "utf8");
    const adminService = readFileSync("src/server/services/admin-service.ts", "utf8");
    const route = readFileSync("app/api/admin/historical-library/projections/rebuild/route.ts", "utf8");

    assert.match(libraryService, /publishedMemoryProjectionService\.generateForAdmission/);
    assert.match(libraryService, /publishedMemoryProjectionService\.generateForRevision/);
    assert.match(libraryService, /publishedMemoryProjectionService\.generateForRetirement/);
    assert.match(libraryService, /publishedMemoryProjectionService\.generateForMerge/);
    assert.match(libraryService, /publishedMemoryProjectionService\.generateForPreservation/);
    assert.match(adminService, /rebuildPublishedMemoryProjections: publishedMemoryProjectionService\.rebuildAll/);
    assert.match(route, /withAdminAuth/);
    assert.match(route, /adminService\.rebuildPublishedMemoryProjections/);
  });

  it("allows Platform read models to consume projection records before snapshot fallback", () => {
    const platformRepository = readFileSync("src/server/repositories/platform-read-model-repository.ts", "utf8");

    assert.match(platformRepository, /publishedMemoryProjectionRepository\.listActiveProjections/);
    assert.match(platformRepository, /if \(projections\.length > 0\)/);
    assert.match(platformRepository, /FROM historical_library_published_snapshots/);
  });
});
