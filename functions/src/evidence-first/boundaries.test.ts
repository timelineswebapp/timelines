import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(process.cwd(), "..");
const orchestrator = readFileSync(resolve(root, "functions/src/evidence-first/orchestrator.ts"), "utf8");
const runner = readFileSync(resolve(root, "scripts/run-evidence-first-shadow.ts"), "utf8");
const protectedState = readFileSync(resolve(root, "functions/src/evidence-first/protected-state.ts"), "utf8");

test("evidence-first orchestration has no institutional or public mutation dependency", () => {
  const forbiddenImports = ["governance", "historical-library", "published-memory", "projection", "search", "pipeline"];
  for (const name of forbiddenImports) {
    assert.doesNotMatch(orchestrator, new RegExp(`from [\"'][^\"']*${name}`, "iu"));
  }
  assert.doesNotMatch(orchestrator, /governancePackages|libraryAdmissions|publishedMemory|platformReadModels|searchDocuments|sitemapDocuments/u);
});

test("shadow runner observes protected collections but never writes them", () => {
  for (const collection of ["governancePackages", "governanceDecisions", "governanceQueues", "libraryAdmissions", "publishedMemory", "platformReadModels", "searchDocuments", "sitemapDocuments"]) {
    assert.match(protectedState, new RegExp(`\"${collection}\"`, "u"));
  }
  assert.doesNotMatch(`${runner}\n${protectedState}`, /collection\([^)]*(governancePackages|governanceDecisions|governanceQueues|libraryAdmissions|publishedMemory|platformReadModels|searchDocuments|sitemapDocuments)[^)]*\)\s*\.(add|set|update|delete|create)/u);
});
