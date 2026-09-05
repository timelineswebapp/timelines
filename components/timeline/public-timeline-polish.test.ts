import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const eventRow = readFileSync("components/timeline/EventRow.tsx", "utf8");
const detailSheet = readFileSync("components/timeline/EventDetailSheet.tsx", "utf8");
const milestonePage = readFileSync("app/milestone/[id]/[slug]/page.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");

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
