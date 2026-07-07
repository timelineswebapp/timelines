import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runSearchCertificationCommand } from "@/src/server/search-certification/command";
import type { SearchCertificationPersistence, SearchCertificationReport } from "@/src/server/search-certification/contracts";
import { searchTierACorpus } from "@/src/server/search-certification/tier-a-corpus";
import {
  buildSearchCertificationReport,
  searchCertificationService
} from "@/src/server/services/search-certification-service";

test("search end-to-end certification passes Tier-A corpus", () => {
  const report = buildSearchCertificationReport();
  assert.equal(report.kind, "search_end_to_end");
  assert.equal(report.scope, "end-to-end");
  assert.equal(report.status, "passed");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.equal(report.summary.caseCount, 4);
  assert.equal(report.summary.invariantCount, 96);
  assert.equal(report.summary.failedInvariantCount, 0);
  assert.equal(report.failureStatistics.tested, 100);
  assert.equal(report.failureStatistics.failed, 0);
  assert.deepEqual(report.boundary.excludes, ["timeline_generation", "public_apis", "ui", "rendering", "platform"]);
});

test("search certification is deterministic", () => {
  const first = buildSearchCertificationReport(searchTierACorpus);
  const second = buildSearchCertificationReport([...searchTierACorpus].reverse().reverse());
  assert.equal(first.corpusFingerprint, second.corpusFingerprint);
  assert.deepEqual(first.caseResults.map((item) => item.actualFingerprint), second.caseResults.map((item) => item.actualFingerprint));
  assert.deepEqual(first.searchStatistics, second.searchStatistics);
});

test("search certification verifies mandatory areas and failure injections", () => {
  const report = buildSearchCertificationReport();
  for (const result of report.caseResults) {
    assert.equal(result.searchResults.length, 16);
    assert.ok(result.searchResults.every((item) => item.passed && item.projectionVerified && item.lineageVerified && item.auditVerified));
    assert.equal(result.failureInjectionResults.length, 25);
    assert.ok(result.failureInjectionResults.every((item) => item.passed && item.actual === "fail_closed"));
  }
});

test("search certification persists through immutable persistence contract", async () => {
  let persisted: SearchCertificationReport | null = null;
  const persistence: SearchCertificationPersistence = {
    async createReport(report) {
      persisted = { ...report, certificationRunId: "sr-run" };
      return persisted;
    }
  };
  const report = await searchCertificationService.certify({ actor: "test", persistence });
  assert.equal(report.certificationRunId, "sr-run");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.ok(persisted);
});

test("search command supports only end-to-end scope", async () => {
  const persistence: SearchCertificationPersistence = {
    async createReport(report) {
      return { ...report, certificationRunId: "sr-command-run" };
    }
  };
  const output: string[] = [];
  assert.equal(await runSearchCertificationCommand({ actor: "test", scope: "end-to-end", persistence, write: (line) => output.push(line) }), 0);
  assert.equal(JSON.parse(output[0]!).report.kind, "search_end_to_end");
  const failed: string[] = [];
  assert.equal(await runSearchCertificationCommand({ actor: "test", persistence, write: (line) => failed.push(line) }), 1);
  assert.equal(JSON.parse(failed[0]!).ok, false);
});

test("search certification command, migration, and rollback are registered", () => {
  const packageJson = readFileSync("package.json", "utf8");
  const script = readFileSync("scripts/certify-search.ts", "utf8");
  const migration = readFileSync("db/migrations/20260728_search_end_to_end_certification.sql", "utf8");
  const rollback = readFileSync("db/rollbacks/20260728_search_end_to_end_certification.sql", "utf8");
  assert.match(packageJson, /ops:search:certify/);
  assert.match(packageJson, /test:search-certification/);
  assert.match(script, /--scope/);
  assert.match(script, /end-to-end/);
  assert.match(script, /--epic/);
  assert.match(migration, /search_certification_runs/);
  assert.match(migration, /search-certification-v1/);
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(rollback, /DROP TABLE IF EXISTS search_certification_runs/);
});

test("search certification stops before timeline generation and platform", () => {
  const report = buildSearchCertificationReport();
  const serialized = JSON.stringify(report);
  assert.match(serialized, /search_authority/);
  assert.doesNotMatch(serialized, /timeline_generation_authority|public_api_authority|platform_authority/);
});

test("search certification verifies repository-backed query consistency and preservation", () => {
  const report = buildSearchCertificationReport();
  const serialized = JSON.stringify(report);
  assert.match(serialized, /query_consistency/);
  assert.match(serialized, /index_immutable/);
  assert.match(serialized, /authority_continuity_preserved/);
  assert.ok(report.determinismResults.every((item) => item.passed));
  assert.ok(report.replayResults.every((item) => item.passed));
  assert.ok(report.recoveryResults.every((item) => item.passed));
});
