import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type {
  EditorialCertificationPersistence,
  EditorialCertificationReport
} from "@/src/server/editorial-certification/contracts";
import { ei002TierACorpus } from "@/src/server/editorial-certification/ei002-tier-a-corpus";
import { runEi002CertificationCommand } from "@/src/server/editorial-certification/command";
import {
  buildEi002CertificationReport,
  editorialCertificationService
} from "@/src/server/services/editorial-certification-service";

test("Tier A EI-002 certification is deterministic and reports every invariant", () => {
  const first = buildEi002CertificationReport();
  const second = buildEi002CertificationReport([...ei002TierACorpus].reverse().reverse());
  assert.deepEqual(first, second);
  assert.equal(first.status, "passed");
  assert.equal(first.frameworkVersion, "editorial-certification-v1");
  assert.equal(first.corpusVersion, "ei-002-tier-a-v1");
  assert.equal(first.summary.caseCount, 4);
  assert.equal(first.summary.invariantCount, 52);
  assert.equal(first.summary.failedInvariantCount, 0);
  for (const result of first.caseResults) {
    assert.equal(result.status, "passed");
    assert.equal(result.invariants.length, 13);
    assert.equal(new Set(result.invariants.map((item) => item.invariantKey)).size, 13);
    assert.equal(result.expectedFingerprint, result.actualFingerprint);
  }
});

test("fingerprint and package-lineage regressions fail individual invariants", () => {
  const baseline = ei002TierACorpus[0]!;
  const broken = {
    ...baseline,
    expectedCompilerFingerprint: "f".repeat(64),
    observedPackage: {
      ...baseline.observedPackage,
      milestoneAuthorityRefs: ["00000000-0000-4000-8000-000000009999"]
    }
  };
  const report = buildEi002CertificationReport([broken]);
  const invariants = new Map(report.caseResults[0]!.invariants.map((item) => [item.invariantKey, item.passed]));
  assert.equal(report.status, "failed");
  assert.equal(invariants.get("fingerprint_stability"), false);
  assert.equal(invariants.get("package_lineage_subset"), false);
  assert.equal(invariants.get("governance_candidate_exclusion"), false);
  assert.equal(report.summary.failedInvariantCount, 3);
});

test("service persists one immutable technical report without authority decisions", async () => {
  let persisted: EditorialCertificationReport | null = null;
  const persistence: EditorialCertificationPersistence = {
    async createReport(report) {
      const result = { ...report, certificationRunId: "00000000-0000-4000-8000-000000000900" };
      if (result.epic === "EI-002") persisted = result;
      return result;
    }
  };
  const report: EditorialCertificationReport = await editorialCertificationService.certifyEi002({ actor: "test", persistence });
  assert.equal(report.authorityDecision, false);
  assert.equal(report.publicationReadinessDecision, false);
  assert.equal(report.status, "passed");
  assert.equal(report, persisted);
});

test("command emits machine-readable JSON and returns zero only for passing certification", async () => {
  const output: string[] = [];
  const persistence: EditorialCertificationPersistence = {
    async createReport(report) {
      return { ...report, certificationRunId: "00000000-0000-4000-8000-000000000901" };
    }
  };
  const exitCode = await runEi002CertificationCommand({
    actor: "command-test",
    persistence,
    write: (line) => output.push(line)
  });
  assert.equal(exitCode, 0);
  const parsed = JSON.parse(output[0]!);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.component, "editorial_intelligence_certification");
  assert.equal(parsed.report.status, "passed");

  const failedOutput: string[] = [];
  const failedExitCode = await runEi002CertificationCommand({
    actor: "command-test",
    persistence: { async createReport() { throw new Error("persistence unavailable"); } },
    write: (line) => failedOutput.push(line)
  });
  assert.equal(failedExitCode, 1);
  assert.equal(JSON.parse(failedOutput[0]!).ok, false);
});

test("certification persistence is immutable, versioned, and stores exact inputs and fingerprints", () => {
  const migration = readFileSync("db/migrations/20260716_editorial_certification_foundation.sql", "utf8");
  const repository = readFileSync("src/server/repositories/editorial-certification-repository.ts", "utf8");
  for (const table of [
    "factory_editorial_certification_runs",
    "factory_editorial_certification_case_results",
    "factory_editorial_certification_invariant_results"
  ]) {
    assert.match(migration, new RegExp(`BEFORE UPDATE OR DELETE ON ${table}`));
  }
  for (const field of [
    "framework_version", "corpus_version", "corpus_fingerprint", "compiler_version",
    "selection_algorithm_version", "expected_fingerprint", "actual_fingerprint", "exact_input"
  ]) assert.match(migration, new RegExp(field));
  assert.match(repository, /withWriteTransaction/);
  assert.match(repository, /caseResult\.invariants/);
  assert.doesNotMatch(repository, /UPDATE |DELETE FROM/);
});

test("certification remains Factory technical evidence and does not mutate institutional state", () => {
  const service = readFileSync("src/server/services/editorial-certification-service.ts", "utf8");
  const command = readFileSync("scripts/certify-editorial-intelligence.ts", "utf8");
  assert.doesNotMatch(service + command, /governanceService|historicalLibraryService|publishedMemory|transitionPackage|certifyReadiness/);
  assert.match(service, /authorityDecision: false/);
  assert.match(service, /publicationReadinessDecision: false/);
});
