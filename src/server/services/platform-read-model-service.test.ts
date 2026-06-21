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

    assert.match(repository, /FROM historical_library_published_snapshots/);
    assert.match(repository, /WHERE lifecycle = 'active'/);
    assert.match(repository, /historical_library_retirements/);
    assert.match(repository, /historical_library_merges/);
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

    assert.match(service, /platformReadModelService\.hasPublishedReadModels/);
    assert.match(service, /platformReadModelService\.listFeaturedTimelines/);
    assert.match(service, /platformReadModelService\.getTimelineBySlug/);
    assert.match(service, /platformReadModelService\.listSitemapEntries/);
    assert.match(service, /platformReadModelService\.searchKnowledge/);
    assert.match(service, /platformReadModelService\.getHistoricalObjectBySlug/);
    assert.match(readModelService, /resolveContinuity/);
    assert.match(readModelService, /resolutionType: "merged"/);
    assert.match(readModelService, /resolutionType: "retired"/);
    assert.match(readModelService, /listPublishedReadModels\("timeline"/);
    assert.match(readModelService, /listPublishedReadModels\("milestone"/);
    assert.doesNotMatch(readModelService, /factoryRepository|governanceRepository|historicalAuthorityRepository/);
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
