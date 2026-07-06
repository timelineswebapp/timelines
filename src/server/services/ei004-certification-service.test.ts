import assert from "node:assert/strict";
import test from "node:test";
import { ei004TierACorpus } from "@/src/server/editorial-certification/ei004-tier-a-corpus";
import { buildEi004CertificationReport, certifyEi004Case, ei004CertificationService } from "@/src/server/services/ei004-certification-service";
import { runEditorialCertificationCommand } from "@/src/server/editorial-certification/command";

test("EI-004 Tier A certifies four subjects and all invariants", () => {
  const report = buildEi004CertificationReport();
  assert.equal(report.status, "passed");
  assert.equal(report.summary.caseCount, 4);
  assert.equal(report.summary.passedCaseCount, 4);
  assert.equal(report.summary.invariantCount, 112);
  assert.equal(report.summary.failedInvariantCount, 0);
});

test("EI-004 corruption fixtures fail exact invariants", () => {
  const base = ei004TierACorpus[0]!;
  const mutations: Array<[any, string]> = [
    [{ ...base, policyFingerprint: "0".repeat(64) }, "policy_lineage"],
    [{ ...base, providerFingerprint: "0".repeat(64) }, "provider_lineage"],
    [{ ...base, selectedMilestoneIds: ["unknown"] }, "milestone_coverage"],
    [{ ...base, sourceSnapshotIds: ["unknown"] }, "citation_snapshot_lineage"],
    [{ ...base, observedGenerationCallsOnResume: 1 }, "generation_unit_reuse"],
    [{ ...base, observedPackage: { ...base.observedPackage, artifactRefs: [] } }, "package_lineage"],
    [{ ...base, observedGovernanceAuthorityRefs: [...base.observedGovernanceAuthorityRefs, base.narrative.factoryObjectId!] }, "governance_exclusion"]
  ];
  for (const [value, key] of mutations) {
    assert.equal(certifyEi004Case(value).invariants.find((item) => item.invariantKey === key)?.passed, false, key);
  }
});

test("EI-004 uses shared persistence and machine-readable command", async () => {
  const persistence = { async createReport(report: any) { return { ...report, certificationRunId: "run-ei004" }; } };
  assert.equal((await ei004CertificationService.certify({ actor: "test", persistence })).certificationRunId, "run-ei004");
  const lines: string[] = [];
  assert.equal(await runEditorialCertificationCommand({ actor: "test", epic: "EI-004", persistence, write: (line) => lines.push(line) }), 0);
  assert.equal(JSON.parse(lines[0]!).report.epic, "EI-004");
});
