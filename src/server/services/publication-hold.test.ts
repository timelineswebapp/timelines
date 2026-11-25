import assert from "node:assert/strict";
import test from "node:test";
import { platformReadModelRepository } from "@/src/server/repositories/platform-read-model-repository";
import { platformReadModelService } from "@/src/server/services/platform-read-model-service";

const heldSlug = "the-fall-of-the-berlin-wall";

function timeline(slug: string, events: Array<{ id: number; tags: Array<{ id: number; slug: string; name: string }> }> = [], tags: Array<{ id: number; slug: string; name: string }> = []) {
  return {
    id: slug === heldSlug ? 2 : 1,
    title: slug,
    slug,
    description: "test",
    category: "History",
    orderingMode: "chronological" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    tags,
    eventCount: 1,
    highlightedEventTitles: [],
    events
  };
}

test("Founder-held Berlin timeline is removed from public lists, routes, search, and sitemap without mutating the source projection", async () => {
  const originalList = platformReadModelRepository.listPublishedReadModels;
  const originalDetail = platformReadModelRepository.getPublishedReadModelBySlug;
  const originalSearch = platformReadModelRepository.searchPublishedReadModels;
  const originalSitemap = platformReadModelRepository.listSitemapDocuments;
  const originalTags = platformReadModelRepository.listTags;
  platformReadModelRepository.listPublishedReadModels = async () => [
    { snapshotId: "held", authorityRef: { authorityType: "timeline", authorityId: "held" }, readModelType: "timeline", slug: heldSlug, payload: timeline(heldSlug) },
    { snapshotId: "visible", authorityRef: { authorityType: "timeline", authorityId: "visible" }, readModelType: "timeline", slug: "apollo", payload: timeline("apollo") }
  ];
  platformReadModelRepository.getPublishedReadModelBySlug = async () => ({ snapshotId: "held", authorityRef: { authorityType: "timeline", authorityId: "held" }, readModelType: "timeline", slug: heldSlug, payload: timeline(heldSlug, [{ id: 200, tags: [{ id: 3, slug: "east-berlin", name: "East Berlin" }] }], [{ id: 2, slug: "berlin", name: "Berlin" }]) });
  platformReadModelRepository.searchPublishedReadModels = async () => ({
    total: 1,
    matches: [{ rank: 1, snapshot: { snapshotId: "held", authorityRef: { authorityType: "search", authorityId: "held" }, readModelType: "search", slug: heldSlug, payload: { type: "timeline", id: 2, timeline: timeline(heldSlug) } } }]
  });
  platformReadModelRepository.listSitemapDocuments = async () => [
    { kind: "timeline", slug: heldSlug, updatedAt: "2026-01-01T00:00:00.000Z" },
    { kind: "timeline", slug: "apollo", updatedAt: "2026-01-01T00:00:00.000Z" },
    { kind: "milestone", id: 200, title: "Berlin milestone", updatedAt: "2026-01-01T00:00:00.000Z" },
    { kind: "milestone", id: 100, title: "Apollo milestone", updatedAt: "2026-01-01T00:00:00.000Z" }
  ];
  platformReadModelRepository.listTags = async () => [
    { id: 2, slug: "berlin", name: "Berlin" },
    { id: 3, slug: "east-berlin", name: "East Berlin" },
    { id: 1, slug: "apollo", name: "Apollo" }
  ];
  try {
    assert.deepEqual((await platformReadModelService.listFeaturedTimelines(12)).map((entry) => entry.slug), ["apollo"]);
    assert.equal(await platformReadModelService.getTimelineBySlug(heldSlug), null);
    assert.deepEqual(await platformReadModelService.searchKnowledge("Berlin"), { query: "berlin", total: 0, items: [] });
    assert.deepEqual((await platformReadModelService.listSitemapEntries()).map((entry) => entry.slug), ["apollo"]);
    assert.deepEqual((await platformReadModelService.listMilestoneSitemapEntries()).map((entry) => entry.id), [100]);
    assert.deepEqual((await platformReadModelService.listTags()).map((entry) => entry.slug), ["apollo"]);
    assert.equal(await platformReadModelService.getTagDetail("berlin"), null);
  } finally {
    platformReadModelRepository.listPublishedReadModels = originalList;
    platformReadModelRepository.getPublishedReadModelBySlug = originalDetail;
    platformReadModelRepository.searchPublishedReadModels = originalSearch;
    platformReadModelRepository.listSitemapDocuments = originalSitemap;
    platformReadModelRepository.listTags = originalTags;
  }
});
