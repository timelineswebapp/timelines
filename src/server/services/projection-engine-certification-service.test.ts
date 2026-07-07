import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runProjectionEngineCertificationCommand } from "@/src/server/projection-engine-certification/command";
import type { ProjectionEngineCertificationPersistence, ProjectionEngineCertificationReport } from "@/src/server/projection-engine-certification/contracts";
import { projectionEngineTierACorpus } from "@/src/server/projection-engine-certification/tier-a-corpus";
import {
  buildProjectionEngineCertificationReport,
  projectionEngineCertificationService
} from "@/src/server/services/projection-engine-certification-service";

test("projection engine end-to-end certification passes Tier-A corpus", () => {
  const report = buildProjectionEngineCertificationReport();
  assert.equal(report.kind, "projection_engine_end_to_end");
  assert.equal(report.scope, "end-to-end");
  assert.equal(report.status, "passed");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.equal(report.summary.caseCount, 4);
  assert.equal(report.summary.invariantCount, 88);
  assert.equal(report.summary.failedInvariantCount, 0);
  assert.equal(report.failureStatistics.tested, 84);
  assert.equal(report.failureStatistics.failed, 0);
  assert.deepEqual(report.boundary.excludes, ["search", "timeline_generation", "public_apis", "ui", "rendering", "platform"]);
});

test("projection engine certification is deterministic", () => {
  const first = buildProjectionEngineCertificationReport(projectionEngineTierACorpus);
  const second = buildProjectionEngineCertificationReport([...projectionEngineTierACorpus].reverse().reverse());
  assert.equal(first.corpusFingerprint, second.corpusFingerprint);
  assert.deepEqual(first.caseResults.map((item) => item.actualFingerprint), second.caseResults.map((item) => item.actualFingerprint));
});

test("projection engine certification verifies projection areas and failures", () => {
  const report = buildProjectionEngineCertificationReport();
  for (const result of report.caseResults) {
    assert.equal(result.projectionResults.length, 10);
    assert.ok(result.projectionResults.every((item) => item.passed && item.lineageVerified && item.auditVerified));
    assert.equal(result.failureInjectionResults.length, 21);
    assert.ok(result.failureInjectionResults.every((item) => item.passed && item.actual === "fail_closed"));
  }
});

test("projection engine certification persists through immutable persistence contract", async () => {
  let persisted: ProjectionEngineCertificationReport | null = null;
  const persistence: ProjectionEngineCertificationPersistence = {
    async createReport(report) {
      persisted = { ...report, certificationRunId: "pr-run" };
      return persisted;
    }
  };
  const report = await projectionEngineCertificationService.certify({ actor: "test", persistence });
  assert.equal(report.certificationRunId, "pr-run");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.ok(persisted);
});

test("projection engine command supports only end-to-end scope", async () => {
  const persistence: ProjectionEngineCertificationPersistence = {
    async createReport(report) {
      return { ...report, certificationRunId: "pr-command-run" };
    }
  };
  const output: string[] = [];
  assert.equal(await runProjectionEngineCertificationCommand({ actor: "test", scope: "end-to-end", persistence, write: (line) => output.push(line) }), 0);
  assert.equal(JSON.parse(output[0]!).report.kind, "projection_engine_end_to_end");
  const failed: string[] = [];
  assert.equal(await runProjectionEngineCertificationCommand({ actor: "test", persistence, write: (line) => failed.push(line) }), 1);
  assert.equal(JSON.parse(failed[0]!).ok, false);
});

test("projection engine certification command, migration, and rollback are registered", () => {
  const packageJson = readFileSync("package.json", "utf8");
  const script = readFileSync("scripts/certify-projection-engine.ts", "utf8");
  const migration = readFileSync("db/migrations/20260727_projection_engine_end_to_end_certification.sql", "utf8");
  const rollback = readFileSync("db/rollbacks/20260727_projection_engine_end_to_end_certification.sql", "utf8");
  assert.match(packageJson, /ops:projection-engine:certify/);
  assert.match(script, /--scope/);
  assert.match(script, /end-to-end/);
  assert.match(script, /--epic/);
  assert.match(migration, /projection_engine_certification_runs/);
  assert.match(migration, /projection-engine-certification-v1/);
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(rollback, /DROP TABLE IF EXISTS projection_engine_certification_runs/);
});

test("projection engine certification stops before downstream institutions", () => {
  const report = buildProjectionEngineCertificationReport();
  const serialized = JSON.stringify(report);
  assert.match(serialized, /projection_engine_authority/);
  assert.doesNotMatch(serialized, /search_authority|timeline_generation_authority|platform_authority/);
});
