import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runHistoricalLibraryCertificationCommand } from "@/src/server/historical-library-certification/command";
import type { HistoricalLibraryCertificationPersistence, HistoricalLibraryCertificationReport } from "@/src/server/historical-library-certification/contracts";
import { historicalLibraryTierACorpus } from "@/src/server/historical-library-certification/tier-a-corpus";
import {
  buildHistoricalLibraryCertificationReport,
  historicalLibraryCertificationService
} from "@/src/server/services/historical-library-certification-service";

test("historical library end-to-end certification passes Tier-A corpus", () => {
  const report = buildHistoricalLibraryCertificationReport();
  assert.equal(report.kind, "historical_library_end_to_end");
  assert.equal(report.scope, "end-to-end");
  assert.equal(report.status, "passed");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.equal(report.summary.caseCount, 4);
  assert.equal(report.summary.passedCaseCount, 4);
  assert.equal(report.summary.invariantCount, 92);
  assert.equal(report.summary.failedInvariantCount, 0);
  assert.equal(report.failureStatistics.tested, 64);
  assert.equal(report.failureStatistics.failed, 0);
  assert.deepEqual(report.boundary.excludes, ["published_memory", "projection_engine", "search", "timeline_generation", "public_platform"]);
});

test("historical library certification is deterministic", () => {
  const first = buildHistoricalLibraryCertificationReport(historicalLibraryTierACorpus);
  const second = buildHistoricalLibraryCertificationReport([...historicalLibraryTierACorpus].reverse().reverse());
  assert.equal(first.corpusFingerprint, second.corpusFingerprint);
  assert.deepEqual(first.caseResults.map((item) => item.actualFingerprint), second.caseResults.map((item) => item.actualFingerprint));
  assert.deepEqual(first.determinismResults, second.determinismResults);
});

test("historical library certification verifies every lifecycle and failure injection", () => {
  const report = buildHistoricalLibraryCertificationReport();
  for (const result of report.caseResults) {
    assert.deepEqual(result.lifecycleResults.map((item) => item.operation), [
      "admission", "revision", "merge", "split", "supersession", "withdrawal", "retirement", "preservation"
    ]);
    assert.ok(result.lifecycleResults.every((item) => item.passed && item.continuityVerified && item.auditVerified));
    assert.equal(result.failureInjectionResults.length, 16);
    assert.ok(result.failureInjectionResults.every((item) => item.passed && item.actual === "fail_closed"));
  }
});

test("historical library certification persists through immutable persistence contract", async () => {
  let persisted: HistoricalLibraryCertificationReport | null = null;
  const persistence: HistoricalLibraryCertificationPersistence = {
    async createReport(report) {
      persisted = { ...report, certificationRunId: "hl-run" };
      return persisted;
    }
  };
  const report = await historicalLibraryCertificationService.certify({ actor: "test", persistence });
  assert.equal(report.certificationRunId, "hl-run");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.ok(persisted);
});

test("historical library command supports only end-to-end scope", async () => {
  const persistence: HistoricalLibraryCertificationPersistence = {
    async createReport(report) {
      return { ...report, certificationRunId: "hl-command-run" };
    }
  };
  const output: string[] = [];
  assert.equal(await runHistoricalLibraryCertificationCommand({
    actor: "test",
    scope: "end-to-end",
    persistence,
    write: (line) => output.push(line)
  }), 0);
  const payload = JSON.parse(output[0]!);
  assert.equal(payload.ok, true);
  assert.equal(payload.report.kind, "historical_library_end_to_end");

  const failed: string[] = [];
  assert.equal(await runHistoricalLibraryCertificationCommand({
    actor: "test",
    persistence,
    write: (line) => failed.push(line)
  }), 1);
  assert.equal(JSON.parse(failed[0]!).ok, false);
});

test("historical library certification command, migration, and rollback are registered", () => {
  const packageJson = readFileSync("package.json", "utf8");
  const script = readFileSync("scripts/certify-historical-library.ts", "utf8");
  const migration = readFileSync("db/migrations/20260725_historical_library_end_to_end_certification.sql", "utf8");
  const rollback = readFileSync("db/rollbacks/20260725_historical_library_end_to_end_certification.sql", "utf8");
  assert.match(packageJson, /ops:historical-library:certify/);
  assert.match(script, /--scope/);
  assert.match(script, /end-to-end/);
  assert.match(script, /--epic/);
  assert.match(migration, /historical_library_certification_runs/);
  assert.match(migration, /historical-library-certification-v1/);
  assert.match(migration, /historical-library-end-to-end-v1/);
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(rollback, /DROP TABLE IF EXISTS historical_library_certification_runs/);
});

test("historical library certification does not certify Published Memory or Platform", () => {
  const report = buildHistoricalLibraryCertificationReport();
  const serialized = JSON.stringify(report);
  assert.match(serialized, /historical_library_authority/);
  assert.doesNotMatch(serialized, /published_memory_authority|projection_engine_authority|public_platform_authority/);
});
