import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("platform read models and publication boundary", () => {
  it("defines Platform read-model contracts and repository sourced from Published Memory", () => {
    const contracts = readFileSync("src/server/platform/read-model-contracts.ts", "utf8");
    const repository = readFileSync("src/server/repositories/platform-read-model-repository.ts", "utf8");

    for (const model of [
      "TimelineReadModel",
      "MilestoneReadModel",
      "HistoricalObjectReadModel",
      "RelationshipReadModel",
      "SearchReadModel",
      "SitemapReadModel"
    ]) {
      assert.match(contracts, new RegExp(`type ${model}|export type ${model}`));
    }

    assert.match(repository, /publishedMemoryProjectionRepository\.listActiveProjections/);
    assert.match(repository, /publishedMemoryProjectionRepository\.getActiveProjectionBySlug/);
    assert.match(repository, /publishedMemoryProjectionRepository\.getLatestContinuityProjection/);
    assert.match(repository, /publishedMemoryProjectionRepository\.getActiveRelationshipProjectionByRelationshipId/);
    assert.match(repository, /publishedMemoryProjectionRepository\.listActiveRelationshipProjectionsForAuthorityRef/);
    assert.doesNotMatch(repository, /FROM historical_library_published_snapshots|historical_library_retirements|historical_library_merges|getSql|getWriteSql/);
    assert.doesNotMatch(repository, /factory_objects|factory_package|governance_decisions|governance_publication_packages/);
  });

  it("routes public reads through contentService and not operational repositories", () => {
    const publicRoutes = [
      "app/api/timelines/route.ts",
      "app/api/timelines/[slug]/route.ts",
      "app/api/homepage/timelines/route.ts",
      "app/api/search/route.ts",
      "app/api/tags/[slug]/route.ts",
      "app/page.tsx",
      "app/timeline/[slug]/page.tsx",
      "app/search/page.tsx",
      "app/tag/[slug]/page.tsx",
      "app/category/[slug]/page.tsx",
      "app/object/[slug]/page.tsx",
      "app/milestone/[id]/[slug]/page.tsx",
      "app/sitemap.ts"
    ];

    for (const routePath of publicRoutes) {
      const source = readFileSync(routePath, "utf8");
      assert.match(source, /contentService/);
      assert.doesNotMatch(source, /factoryRepository|governanceRepository|historicalAuthorityRepository|timelineRepository|eventRepository|getSql|getWriteSql/);
    }
  });

  it("migrates public content service reads through Platform read-model service", () => {
    const service = readFileSync("src/server/services/content-service.ts", "utf8");
    const readModelService = readFileSync("src/server/services/platform-read-model-service.ts", "utf8");

    assert.match(service, /platformReadModelService\.listFeaturedTimelines/);
    assert.match(service, /platformReadModelService\.getTimelineBySlug/);
    assert.match(service, /platformReadModelService\.listSitemapEntries/);
    assert.match(service, /platformReadModelService\.listMilestoneSitemapEntries/);
    assert.match(service, /platformReadModelService\.searchKnowledge/);
    assert.match(service, /platformReadModelService\.getHistoricalObjectBySlug/);
    assert.match(service, /platformReadModelService\.getTagDetail/);
    assert.match(service, /platformReadModelService\.getCategoryDetail/);
    assert.match(service, /platformReadModelService\.resolveTimelineRoute/);
    assert.doesNotMatch(service, /timelineRepository|eventRepository|historicalAuthorityRepository|tagRepository|hasPublishedReadModels|getSql|getWriteSql/);
    assert.match(readModelService, /resolveContinuity/);
    assert.match(readModelService, /resolutionType: "merged"/);
    assert.match(readModelService, /resolutionType: "retired"/);
    assert.match(readModelService, /listPublishedReadModels\("timeline"/);
    assert.match(readModelService, /listPublishedReadModels\("milestone"/);
    assert.match(readModelService, /searchPublishedReadModels/);
    assert.match(readModelService, /listPublishedReadModels\("sitemap"/);
    assert.match(readModelService, /getRelationshipById/);
    assert.match(readModelService, /listRelationshipsForAuthorityRef/);
    assert.match(readModelService, /listRelatedObjects/);
    assert.match(readModelService, /listRelatedMilestones/);
    assert.match(readModelService, /listRelatedTimelines/);
    assert.doesNotMatch(readModelService, /factoryRepository|governanceRepository|historicalAuthorityRepository/);
  });

  it("adds bounded relationship read models sourced only from active projections", () => {
    const contracts = readFileSync("src/server/platform/read-model-contracts.ts", "utf8");
    const service = readFileSync("src/server/services/platform-read-model-service.ts", "utf8");
    const platformRepository = readFileSync("src/server/repositories/platform-read-model-repository.ts", "utf8");
    const projectionRepository = readFileSync("src/server/repositories/published-memory-projection-repository.ts", "utf8");

    assert.match(contracts, /PublishedAuthorityRef/);
    assert.match(contracts, /RelatedAuthorityReadModel/);
    assert.match(contracts, /RelationshipReadQuery/);
    for (const field of [
      "relationship_id",
      "publishedSnapshotId",
      "source_authority_ref",
      "target_authority_ref",
      "relationship_type",
      "evidence_refs",
      "provenance",
      "authority_state",
      "published_state",
      "continuity_metadata"
    ]) {
      assert.match(contracts, new RegExp(field));
    }

    assert.match(service, /MAX_RELATIONSHIP_READ_LIMIT = 100/);
    assert.match(service, /clampRelationshipLimit/);
    assert.match(service, /relationshipFromSnapshot/);
    assert.match(service, /otherAuthorityRef/);
    assert.match(service, /relatedAuthoritiesByType/);
    assert.match(service, /platformReadModelRepository\.getRelationshipByRelationshipId/);
    assert.match(service, /platformReadModelRepository\.listRelationshipsForAuthorityRef/);
    assert.doesNotMatch(service, /historicalRelationshipRepository|historicalAuthorityRepository|getSql|getWriteSql/);

    assert.match(platformRepository, /getRelationshipByRelationshipId/);
    assert.match(platformRepository, /listRelationshipsForAuthorityRef/);
    assert.match(platformRepository, /publishedMemoryProjectionRepository\.getActiveRelationshipProjectionByRelationshipId/);
    assert.match(platformRepository, /publishedMemoryProjectionRepository\.listActiveRelationshipProjectionsForAuthorityRef/);
    assert.doesNotMatch(platformRepository, /historicalRelationshipRepository|historicalAuthorityRepository|getSql|getWriteSql/);

    assert.match(projectionRepository, /getActiveRelationshipProjectionByRelationshipId/);
    assert.match(projectionRepository, /listActiveRelationshipProjectionsForAuthorityRef/);
    assert.match(projectionRepository, /projection_type = 'relationship'/);
    assert.match(projectionRepository, /lifecycle = 'active'/);
    assert.match(projectionRepository, /continuity_type IN \('retired', 'merged'\)/);
    assert.match(projectionRepository, /LIMIT \$\{input\.limit\}/);
    assert.doesNotMatch(projectionRepository, /FROM historical_relationships|JOIN historical_relationships/);
  });

  it("keeps every public surface projection-only through contentService", () => {
    const service = readFileSync("src/server/services/content-service.ts", "utf8");
    const surfaces = [
      "listFeaturedTimelines",
      "listHomepageTimelines",
      "getHomepageSnapshotSlice",
      "listStaticSlugs",
      "listSitemapEntries",
      "listMilestoneSitemapEntries",
      "listCategoryEntries",
      "listTags",
      "getTimeline",
      "resolveTimelineRoute",
      "getEventShareContext",
      "getMilestone",
      "getMilestoneContext",
      "getHistoricalObjectBySlug",
      "getTagDetail",
      "getCategoryDetail",
      "searchTimelines",
      "searchKnowledge"
    ];

    for (const surface of surfaces) {
      const pattern = new RegExp(`${surface}[\\s\\S]*platformReadModelService\\.`);
      assert.match(service, pattern);
    }
    assert.doesNotMatch(service, /return timelineRepository|return eventRepository|return historicalAuthorityRepository|return tagRepository/);
  });

  it("routes SEO, sitemap, and Open Graph generation through projection-backed contentService reads", () => {
    const files = [
      "app/timeline/[slug]/page.tsx",
      "app/milestone/[id]/[slug]/page.tsx",
      "app/object/[slug]/page.tsx",
      "app/tag/[slug]/page.tsx",
      "app/category/[slug]/page.tsx",
      "app/search/page.tsx",
      "app/sitemap.ts",
      "app/og/timeline/[slug]/route.tsx",
      "app/og/event/[eventId]/route.tsx"
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.match(source, /contentService/);
      assert.doesNotMatch(source, /timelineRepository|eventRepository|historicalAuthorityRepository|tagRepository|getSql|getWriteSql/);
    }
  });

  it("keeps public API route tree free of Factory and Governance operational access", () => {
    const publicFiles = listFiles("app")
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .filter((file) => !file.includes("/api/admin/") && !file.includes("[adminRoute]"));

    for (const file of publicFiles) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /factoryRepository|governanceRepository|getWriteSql/);
    }
  });
});

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
