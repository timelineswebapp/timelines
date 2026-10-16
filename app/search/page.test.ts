import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public search trims queries and presents an accessible empty-result state", () => {
  const source = readFileSync("app/search/page.tsx", "utf8");
  assert.match(source, /const query = q\.trim\(\)/u);
  assert.match(source, /contentService\.searchKnowledge\(query, 20\)/u);
  assert.match(source, /query && result\.items\.length === 0/u);
  assert.match(source, /role="status" aria-live="polite"/u);
  assert.match(source, /No matching timelines or milestones/u);
});
