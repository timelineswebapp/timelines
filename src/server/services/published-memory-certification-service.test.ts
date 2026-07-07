import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runPublishedMemoryCertificationCommand } from "@/src/server/published-memory-certification/command";
import type { PublishedMemoryCertificationPersistence, PublishedMemoryCertificationReport } from "@/src/server/published-memory-certification/contracts";
import { publishedMemoryTierACorpus } from "@/src/server/published-memory-certification/tier-a-corpus";
import {
  buildPublishedMemoryCertificationReport,
  publishedMemoryCertificationService
} from "@/src/server/services/published-memory-certification-service";

test("published memory end-to-end certification passes Tier-A corpus", () => {
  const report = buildPublishedMemoryCertificationReport();
  assert.equal(report.kind, "published_memory_end_to_end");
  assert.equal(report.scope, "end-to-end");
  assert.equal(report.status, "passed");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.equal(report.summary.caseCount, 4);
  assert.equal(report.summary.passedCaseCount, 4);
  assert.equal(report.summary.invariantCount, 96);
  assert.equal(report.summary.failedInvariantCount, 0);
  assert.equal(report.failureStatistics.tested, 72);
  assert.equal(report.failureStatistics.failed, 0);
  assert.deepEqual(report.boundary.excludes, ["projection_engine", "search", "timeline_generation", "public_rendering", "apis", "ui", "platform"]);
});

test("published memory certification is deterministic", () => {
  const first = buildPublishedMemoryCertificationReport(publishedMemoryTierACorpus);
  const second = buildPublishedMemoryCertificationReport([...publishedMemoryTierACorpus].reverse().reverse());
  assert.equal(first.corpusFingerprint, second.corpusFingerprint);
  assert.deepEqual(first.caseResults.map((item) => item.actualFingerprint), second.caseResults.map((item) => item.actualFingerprint));
  assert.deepEqual(first.determinismResults, second.determinismResults);
});

test("published memory certification verifies lifecycle and failure injection coverage", () => {
  const report = buildPublishedMemoryCertificationReport();
  for (const result of report.caseResults) {
    assert.deepEqual(result.lifecycleResults.map((item) => item.operation), [
      "admission", "revision", "version", "merge_continuity", "split_continuity",
      "supersession_continuity", "withdrawal_continuity", "retirement_continuity",
      "preservation_continuity", "replay_continuity", "recovery_continuity"
    ]);
    assert.ok(result.lifecycleResults.every((item) => item.passed && item.lineageVerified && item.auditVerified));
    assert.equal(result.failureInjectionResults.length, 18);
    assert.ok(result.failureInjectionResults.every((item) => item.passed && item.actual === "fail_closed"));
  }
});

test("published memory certification persists through immutable persistence contract", async () => {
  let persisted: PublishedMemoryCertificationReport | null = null;
  const persistence: PublishedMemoryCertificationPersistence = {
    async createReport(report) {
      persisted = { ...report, certificationRunId: "pm-run" };
      return persisted;
    }
  };
  const report = await publishedMemoryCertificationService.certify({ actor: "test", persistence });
  assert.equal(report.certificationRunId, "pm-run");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.ok(persisted);
});

test("published memory command supports only end-to-end scope", async () => {
  const persistence: PublishedMemoryCertificationPersistence = {
    async createReport(report) {
      return { ...report, certificationRunId: "pm-command-run" };
    }
  };
  const output: string[] = [];
  assert.equal(await runPublishedMemoryCertificationCommand({
    actor: "test",
    scope: "end-to-end",
    persistence,
    write: (line) => output.push(line)
  }), 0);
  const payload = JSON.parse(output[0]!);
  assert.equal(payload.ok, true);
  assert.equal(payload.report.kind, "published_memory_end_to_end");

  const failed: string[] = [];
  assert.equal(await runPublishedMemoryCertificationCommand({
    actor: "test",
    persistence,
    write: (line) => failed.push(line)
  }), 1);
  assert.equal(JSON.parse(failed[0]!).ok, false);
});

test("published memory certification command, migration, and rollback are registered", () => {
  const packageJson = readFileSync("package.json", "utf8");
  const script = readFileSync("scripts/certify-published-memory.ts", "utf8");
  const migration = readFileSync("db/migrations/20260726_published_memory_end_to_end_certification.sql", "utf8");
  const rollback = readFileSync("db/rollbacks/20260726_published_memory_end_to_end_certification.sql", "utf8");
  assert.match(packageJson, /ops:published-memory:certify/);
  assert.match(script, /--scope/);
  assert.match(script, /end-to-end/);
  assert.match(script, /--epic/);
  assert.match(migration, /published_memory_certification_runs/);
  assert.match(migration, /published-memory-certification-v1/);
  assert.match(migration, /published-memory-end-to-end-v1/);
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(rollback, /DROP TABLE IF EXISTS published_memory_certification_runs/);
});

test("published memory certification stops before projections and Platform", () => {
  const report = buildPublishedMemoryCertificationReport();
  const serialized = JSON.stringify(report);
  assert.match(serialized, /published_memory_authority/);
  assert.doesNotMatch(serialized, /projection_engine_authority|search_authority|timeline_generation_authority|platform_authority/);
});
