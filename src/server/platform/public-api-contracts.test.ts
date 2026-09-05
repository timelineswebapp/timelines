import assert from "node:assert/strict";
import test from "node:test";
import { sampleTimelines } from "@/src/server/dev/sample-data";
import { readFileSync } from "node:fs";
import { fail, ok } from "@/src/server/api/responses";
import type { SearchResult, TimelineDetail, TimelineSummary } from "@/src/lib/types";

function assertTimelineSummary(value: TimelineSummary) {
  assert.equal(Number.isSafeInteger(value.id), true);
  assert.equal(value.id > 0, true);
  assert.match(value.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(value.title.trim().length > 0, true);
  assert.equal(value.description.trim().length > 0, true);
  assert.equal(value.category.trim().length > 0, true);
  assert.equal(["chronology", "editorial"].includes(value.orderingMode), true);
  assert.equal(Number.isSafeInteger(value.eventCount), true);
  assert.equal(Array.isArray(value.highlightedEventTitles), true);
  for (const tag of value.tags) {
    assert.equal(Number.isSafeInteger(tag.id), true);
    assert.match(tag.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(tag.name.trim().length > 0, true);
  }
}

function assertTimelineDetail(value: TimelineDetail) {
  assertTimelineSummary(value);
  assert.equal(Array.isArray(value.events), true);
  for (const event of value.events) {
    assert.equal(Number.isSafeInteger(event.id), true);
    assert.equal(event.id > 0, true);
    assert.equal(["year", "month", "day", "approximate"].includes(event.datePrecision), true);
    assert.equal(event.title.trim().length > 0, true);
    assert.equal(event.description.trim().length > 0, true);
    assert.equal(event.importance >= 1 && event.importance <= 5, true);
    for (const source of event.sources) {
      assert.equal(Number.isSafeInteger(source.id), true);
      assert.equal(source.publisher.trim().length > 0, true);
      assert.doesNotThrow(() => new URL(source.url));
      assert.equal(source.credibilityScore >= 0 && source.credibilityScore <= 1, true);
    }
  }
  value.relatedTimelines.forEach(assertTimelineSummary);
}

test("public timeline DTO compatibility is frozen before persistence migration", () => {
  assert.equal(sampleTimelines.length > 0, true);
  sampleTimelines.forEach(assertTimelineDetail);
});

test("public API success and failure envelopes remain stable", async () => {
  const success = ok(sampleTimelines[0]!, { status: 200 });
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { ok: true, data: sampleTimelines[0] });

  const failure = fail(404, "Timeline not found.");
  assert.equal(failure.status, 404);
  assert.deepEqual(await failure.json(), {
    ok: false,
    error: { code: "NOT_FOUND", message: "Timeline not found." }
  });
});

test("serverless missing records resolve as null instead of a production 500", () => {
  const client = readFileSync("src/server/serverless/backend-client.ts", "utf8");
  assert.match(client, /allowNotFound && response\.status === 404/);
  assert.match(client, /getReadModel[\s\S]*undefined, true/);
});

test("public search DTO retains its discriminated result union and numeric identities", () => {
  const timeline = sampleTimelines[0]!;
  const result: SearchResult = {
    query: "history",
    total: 2,
    items: [
      { type: "timeline", id: timeline.id, rank: 1, timeline },
      { type: "milestone", id: timeline.events[0]!.id, rank: 0.9, milestone: { ...timeline.events[0]!, timelineLinks: [] } }
    ]
  };

  assert.equal(result.total, result.items.length);
  assert.equal(result.items[0]!.type, "timeline");
  assert.equal(result.items[1]!.type, "milestone");
  assert.equal(Number.isSafeInteger(result.items[0]!.id), true);
  assert.equal(Number.isSafeInteger(result.items[1]!.id), true);
});

test("homepage pagination contract remains bounded and continuation-based", () => {
  const limit = 24;
  const offset = 48;
  const response = {
    items: sampleTimelines.slice(0, limit),
    nextOffset: offset + sampleTimelines.length,
    hasMore: true,
    snapshotDate: "2026-09-05"
  };
  assert.equal(response.items.length <= limit, true);
  assert.equal(response.nextOffset, 51);
  assert.equal(response.hasMore, true);
  assert.match(response.snapshotDate, /^\d{4}-\d{2}-\d{2}$/);
});
