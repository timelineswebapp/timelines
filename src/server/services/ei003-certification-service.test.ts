import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ei003TierACorpus } from "@/src/server/editorial-certification/ei003-tier-a-corpus";
import { buildEi003CertificationReport, ei003CertificationService } from "@/src/server/services/ei003-certification-service";
import { runEditorialCertificationCommand } from "@/src/server/editorial-certification/command";
import type { EditorialCertificationPersistence } from "@/src/server/editorial-certification/contracts";

test("Tier A certifies all EI-003 deterministic structure invariants", () => {
  const first = buildEi003CertificationReport();
  const second = buildEi003CertificationReport();
  assert.deepEqual(first, second);
  assert.equal(first.status, "passed");
  assert.equal(first.corpusVersion, "ei-003-tier-a-v1");
  assert.equal(first.summary.caseCount, 8);
  assert.equal(first.summary.passedCaseCount, 8);
  assert.equal(first.summary.invariantCount, 176);
  assert.equal(first.summary.passedInvariantCount, 176);
  assert.equal(first.caseResults.some((item) => item.topic === "Roman Republic"), true);
  assert.equal(first.caseResults.some((item) => item.topic === "Internet"), true);
  assert.equal(ei003TierACorpus.some((item) => item.plannerInput.timelineCandidate.selectedMilestones.length === 200), true);
});

test("EI-003 reports fingerprints, versions, exact inputs, outputs, and every invariant", () => {
  const result = buildEi003CertificationReport().caseResults[0]!;
  assert.match(result.actualFingerprint, /^[a-f0-9]{64}$/);
  assert.match(result.actualOutputFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(result.plannerVersion, "ei-003-planner-v1");
  assert.equal(result.structureAlgorithmVersion, "ei-003-composition-v1");
  assert.ok(result.actualCompositionOutput);
  assert.equal(result.invariants.length, 22);
  assert.equal(new Set(result.invariants.map((item) => item.invariantKey)).size, 22);
});

test("EI-003 service persists immutable technical evidence without authority decisions", async () => {
  let persistedEpic = "";
  const persistence: EditorialCertificationPersistence = {
    async createReport(report) {
      persistedEpic = report.epic;
      return { ...report, certificationRunId: "00000000-0000-4000-8000-000000000903" };
    }
  };
  const report = await ei003CertificationService.certify({ actor: "test", persistence });
  assert.equal(persistedEpic, "EI-003");
  assert.equal(report.authorityDecision, false);
  assert.equal(report.publicationReadinessDecision, false);
});

test("shared command supports EI-003 and remains backward compatible with EI-002", async () => {
  const output: string[] = [];
  const persistence: EditorialCertificationPersistence = {
    async createReport(report) {
      return { ...report, certificationRunId: "00000000-0000-4000-8000-000000000904" };
    }
  };
  assert.equal(await runEditorialCertificationCommand({ actor: "test", epic: "EI-003", persistence, write: (line) => output.push(line) }), 0);
  assert.equal(JSON.parse(output[0]!).report.epic, "EI-003");
  output.length = 0;
  assert.equal(await runEditorialCertificationCommand({ actor: "test", persistence, write: (line) => output.push(line) }), 0);
  assert.equal(JSON.parse(output[0]!).report.epic, "EI-002");
});

test("certification migration extends existing immutable storage without parallel tables", () => {
  const migration = readFileSync("db/migrations/20260718_ei003_editorial_certification.sql", "utf8");
  const repository = readFileSync("src/server/repositories/editorial-certification-repository.ts", "utf8");
  assert.match(migration, /epic IN \('EI-002', 'EI-003'\)/);
  for (const column of ["planner_version", "structure_algorithm_version", "input_fingerprint", "output_fingerprint"]) {
    assert.match(migration, new RegExp(column));
    assert.match(repository, new RegExp(column));
  }
  assert.doesNotMatch(migration, /CREATE TABLE/);
  assert.match(repository, /factory_editorial_certification_runs/);
});
