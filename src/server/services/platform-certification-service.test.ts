import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runPlatformCertificationCommand } from "@/src/server/platform-certification/command";
import type { PlatformCertificationPersistence, PlatformCertificationReport } from "@/src/server/platform-certification/contracts";
import { platformTierACorpus } from "@/src/server/platform-certification/tier-a-corpus";
import {
  buildPlatformCertificationReport,
  platformCertificationService
} from "@/src/server/services/platform-certification-service";

test("public platform end-to-end certification passes Tier-A corpus", () => {
  const report = buildPlatformCertificationReport();
  assert.equal(report.kind, "public_platform_end_to_end");
  assert.equal(report.scope, "end-to-end");
  assert.equal(report.status, "passed");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.equal(report.summary.caseCount, 4);
  assert.equal(report.failureStatistics.tested, 128);
  assert.equal(report.failureStatistics.failed, 0);
  assert.equal(report.invariantStatistics.tested, 120);
  assert.equal(report.invariantStatistics.failed, 0);
});

test("public platform certification is deterministic", () => {
  const first = buildPlatformCertificationReport(platformTierACorpus);
  const second = buildPlatformCertificationReport([...platformTierACorpus].reverse().reverse());
  assert.equal(first.corpusFingerprint, second.corpusFingerprint);
  assert.deepEqual(first.caseResults.map((item) => item.actualFingerprint), second.caseResults.map((item) => item.actualFingerprint));
});

test("public platform certification verifies all stages, failures, and invariants per case", () => {
  const report = buildPlatformCertificationReport();
  for (const result of report.caseResults) {
    assert.equal(result.stageResults.length, 19);
    assert.ok(result.stageResults.every((item) => item.status === "passed"));
    assert.equal(result.failureInjectionResults.length, 32);
    assert.ok(result.failureInjectionResults.every((item) => item.passed && item.actual === "fail_closed"));
    assert.equal(result.invariants.length, 30);
    assert.ok(result.invariants.every((item) => item.passed));
  }
});

test("public platform certification persists through immutable persistence contract", async () => {
  let persisted: PlatformCertificationReport | null = null;
  const persistence: PlatformCertificationPersistence = {
    async createReport(report) {
      persisted = { ...report, certificationRunId: "pl-run" };
      return persisted;
    }
  };
  const report = await platformCertificationService.certify({ actor: "test", persistence });
  assert.equal(report.certificationRunId, "pl-run");
  assert.equal(report.finalVerdict, "CERTIFIED");
  assert.ok(persisted);
});

test("public platform command supports only end-to-end scope", async () => {
  const persistence: PlatformCertificationPersistence = {
    async createReport(report) {
      return { ...report, certificationRunId: "pl-command-run" };
    }
  };
  const output: string[] = [];
  assert.equal(await runPlatformCertificationCommand({ actor: "test", scope: "end-to-end", persistence, write: (line) => output.push(line) }), 0);
  assert.equal(JSON.parse(output[0]!).report.kind, "public_platform_end_to_end");
  const failed: string[] = [];
  assert.equal(await runPlatformCertificationCommand({ actor: "test", persistence, write: (line) => failed.push(line) }), 1);
  assert.equal(JSON.parse(failed[0]!).ok, false);
});

test("public platform certification command, migration, and rollback are registered", () => {
  const packageJson = readFileSync("package.json", "utf8");
  const script = readFileSync("scripts/certify-platform.ts", "utf8");
  const migration = readFileSync("db/migrations/20260729_public_platform_end_to_end_certification.sql", "utf8");
  const rollback = readFileSync("db/rollbacks/20260729_public_platform_end_to_end_certification.sql", "utf8");
  assert.match(packageJson, /ops:platform:certify/);
  assert.match(packageJson, /test:platform-certification/);
  assert.match(script, /--scope/);
  assert.match(script, /end-to-end/);
  assert.match(script, /--epic/);
  assert.match(migration, /platform_certification_runs/);
  assert.match(migration, /public-platform-certification-v1/);
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(rollback, /DROP TABLE IF EXISTS platform_certification_runs/);
});

test("public platform certification excludes non-public institutional surfaces", () => {
  const report = buildPlatformCertificationReport();
  assert.deepEqual(report.boundary.excludes, [
    "founder_ui",
    "factory_ui",
    "administration_ui",
    "analytics",
    "advertising",
    "monetization",
    "recommendations",
    "future_ai_services",
    "future_personalization"
  ]);
  const serialized = JSON.stringify(report);
  assert.match(serialized, /public_platform/);
  assert.doesNotMatch(serialized, /founder_ui_authority|factory_ui_authority|administration_ui_authority/);
});

test("public platform certification verifies projection-backed public rendering", () => {
  const report = buildPlatformCertificationReport();
  const serialized = JSON.stringify(report);
  for (const invariant of [
    "projection_fidelity",
    "metadata_fidelity",
    "structured_data_fidelity",
    "deterministic_rendering",
    "api_serialization_deterministic",
    "no_authority_mutation_during_rendering"
  ]) {
    assert.match(serialized, new RegExp(invariant));
  }
  assert.ok(report.determinismResults.every((item) => item.passed));
});
