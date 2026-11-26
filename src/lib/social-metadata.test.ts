import assert from "node:assert/strict";
import test from "node:test";
import { buildTimelinePageMetadata } from "@/src/lib/social-metadata";
import type { TimelineDetail } from "@/src/lib/types";

const timeline = {
  id: 1,
  title: "The Apollo 11 Mission Timeline",
  slug: "the-apollo-11-mission",
  description: "A concise Apollo 11 timeline.",
  category: "Space exploration",
  orderingMode: "chronology",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  tags: [],
  eventCount: 0,
  highlightedEventTitles: [],
  events: [],
  relatedTimelines: []
} satisfies TimelineDetail;

test("timeline share metadata avoids repeating timeline-named titles or adding a brand suffix", () => {
  const metadata = buildTimelinePageMetadata(timeline, null);
  assert.equal(metadata.title, "Timeline of Apollo 11 Mission");
  assert.equal(metadata.openGraph?.title, "Timeline of Apollo 11 Mission");
  assert.equal(metadata.twitter?.title, "Timeline of Apollo 11 Mission");
});
