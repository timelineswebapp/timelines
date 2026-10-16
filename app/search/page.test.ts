import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public search trims queries and presents an accessible empty-result state", () => {
  const source = readFileSync("app/search/page.tsx", "utf8");
  const form = readFileSync("components/forms/SearchBar.tsx", "utf8");
  assert.match(source, /const MAX_PUBLIC_SEARCH_QUERY_LENGTH = 120/u);
  assert.match(source, /if \(typeof value !== "string"\) return ""/u);
  assert.match(source, /value\.trim\(\)\.slice\(0, MAX_PUBLIC_SEARCH_QUERY_LENGTH\)/u);
  assert.match(source, /if \(typeof value !== "string"\) return 1/u);
  assert.match(source, /const query = normalizePublicSearchQuery\(q\)/u);
  assert.match(source, /const SEARCH_PAGE_SIZE = 20/u);
  assert.match(source, /const MAX_SEARCH_PAGE = 500/u);
  assert.match(source, /!\/\^\[1-9\]\\d\*\$\/u\.test\(value\)/u);
  assert.match(source, /const parsed = Number\(value\)/u);
  assert.match(source, /contentService\.searchKnowledge\(query, SEARCH_PAGE_SIZE, \(currentPage - 1\) \* SEARCH_PAGE_SIZE\)/u);
  assert.match(source, /if \(query && result\.total > 0 && currentPage > totalPages\) redirect\(searchPageHref\(query, totalPages\)\)/u);
  assert.match(source, /aria-label="Search result pages"/u);
  assert.match(source, /const canonicalPath = query \? searchPageHref\(query, currentPage\) : "\/search"/u);
  assert.match(source, /url: buildPublicUrl\(canonicalPath\)/u);
  assert.match(source, /query && result\.items\.length === 0/u);
  assert.match(source, /role="status" aria-live="polite"/u);
  assert.match(source, /No matching timelines or milestones/u);
  assert.match(form, /maxLength=\{120\}/u);
});
