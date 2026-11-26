import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const eventRow = readFileSync("components/timeline/EventRow.tsx", "utf8");
const detailSheet = readFileSync("components/timeline/EventDetailSheet.tsx", "utf8");
const milestonePage = readFileSync("app/milestone/[id]/[slug]/page.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");
const homePage = readFileSync("app/page.tsx", "utf8");
const homeFeed = readFileSync("components/timeline/HomeTimelineFeed.tsx", "utf8");
const requestTimelineForm = readFileSync("components/ui/RequestTimelineForm.tsx", "utf8");
const siteNavigationMenu = readFileSync("components/layout/SiteNavigationMenu.tsx", "utf8");

test("timeline event cards retain accessible deep-link detail interaction without institutional copy", () => {
  assert.doesNotMatch(eventRow, /View canonical milestone/);
  assert.match(eventRow, /aria-label={`Open details for \${event\.title}`}/);
  assert.match(eventRow, /onClick=\{\(\) => onOpen\(event\.id\)\}/);
});

test("public event details do not expose the generic source confidence percentage", () => {
  assert.doesNotMatch(detailSheet, /Confidence .*credibilityScore/);
  assert.doesNotMatch(milestonePage, /Confidence .*credibilityScore/);
  assert.match(detailSheet, /rel="noreferrer noopener"/);
});

test("event detail sheet preserves dialog, keyboard, focus, and scrolling accessibility", () => {
  assert.match(detailSheet, /role="dialog"/);
  assert.match(detailSheet, /aria-modal="true"/);
  assert.match(detailSheet, /aria-labelledby=/);
  assert.match(detailSheet, /event\.key === "Escape"/);
  assert.match(detailSheet, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(detailSheet, /previousFocusRef\.current\?\.focus\(\)/);
  assert.match(styles, /\.event-sheet[\s\S]*overflow: auto/);
});

test("event detail sheet uses a strongly separated glass surface with lighter nested sources", () => {
  assert.match(styles, /\.sheet-backdrop[\s\S]*background: rgba\(8, 18, 34, 0\.46\)[\s\S]*blur\(24px\)/);
  assert.match(styles, /\.event-sheet[\s\S]*rgba\(252, 254, 255, 0\.97\)[\s\S]*rgba\(243, 248, 253, 0\.94\)[\s\S]*blur\(38px\)/);
  assert.match(styles, /\.sheet-link[\s\S]*rgba\(255, 255, 255, 0\.76\)[\s\S]*overflow-wrap: anywhere/);
});

test("homepage presents an explicit availability state when its snapshot fails", () => {
  assert.match(homePage, /action: "snapshot_load_failed"/);
  assert.match(homePage, /initialUnavailable=\{homepageSnapshot === null\}/);
  assert.match(homeFeed, /Featured timelines are temporarily unavailable/);
  assert.match(homeFeed, /role="status" aria-live="polite"/);
  assert.match(homeFeed, /More timelines could not be loaded right now/);
  assert.match(homeFeed, /setContinuationError\(true\)/);
  assert.match(homeFeed, /const loadContinuation = useCallback/);
  assert.match(homeFeed, /onClick=\{loadContinuation\}/);
  assert.match(homeFeed, /disabled=\{isLoadingContinuation\}/);
  assert.doesNotMatch(homeFeed, /window\.location\.reload\(\)/);
});

test("homepage prioritizes search and a concise topic suggestion action", () => {
  assert.match(homePage, /className="home-primary-actions"/);
  assert.doesNotMatch(homePage, /className="home-primary-actions glass"/);
  assert.match(homePage, /Search a person, event, or subject/);
  assert.match(homePage, /Can&apos;t find a timeline\?/);
  assert.match(homePage, /triggerLabel="Suggest a topic"/);
  assert.match(styles, /\.home-request-strip[\s\S]*justify-content: flex-end/);
  assert.match(styles, /\.search-input[\s\S]*border-radius: 16px/);
  assert.doesNotMatch(homePage, /Public beta|Find the story in the sequence|Shape the library|growing, curated library/);
  assert.match(requestTimelineForm, /recorded for editorial consideration/);
  assert.match(requestTimelineForm, /currently under editorial review/);
  assert.doesNotMatch(requestTimelineForm, /researching it now|already being researched/);
  assert.doesNotMatch(requestTimelineForm, /queued for research/);
  assert.match(requestTimelineForm, /role="dialog" aria-modal="true" aria-labelledby="request-timeline-title"/);
  assert.match(requestTimelineForm, /event\.key === "Escape"/);
  assert.match(requestTimelineForm, /requestInputRef\.current\?\.focus\(\)/);
  assert.match(requestTimelineForm, /triggerRef\.current\.focus\(\)/);
  assert.match(requestTimelineForm, /previousFocusRef\.current\?\.focus\(\)/);
  assert.match(requestTimelineForm, /event\.key !== "Tab"/);
});

test("public navigation does not promise universal fact-checking or guarantees", () => {
  assert.match(siteNavigationMenu, /Editorial approach/);
  assert.match(siteNavigationMenu, /growing public beta/);
  assert.match(siteNavigationMenu, /reader corrections help improve the library/);
  assert.doesNotMatch(siteNavigationMenu, /direct historical fact-checking|guarantee strict chronological alignment/);
});
