import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { editorialEndToEndTierACorpus } from "@/src/server/editorial-certification/end-to-end-tier-a-corpus";
import { runEditorialCertificationCommand } from "@/src/server/editorial-certification/command";
import {
  buildEditorialEndToEndCertificationReport,
  certifyEditorialEndToEndCase,
  editorialEndToEndCertificationService
} from "@/src/server/services/editorial-end-to-end-certification-service";

test("end-to-end corpus certifies four subjects and every collective invariant", () => {
  const report = buildEditorialEndToEndCertificationReport();
  assert.equal(report.status, "passed");
  assert.equal(report.certificationKind, "end_to_end_editorial_intelligence");
  assert.equal(report.summary.caseCount, 4);
  assert.equal(report.summary.passedCaseCount, 4);
  assert.equal(report.summary.invariantCount, 100);
  assert.equal(report.summary.failedInvariantCount, 0);
  assert.deepEqual(report.stageResults.map((item) => item.stage), [
    "EI-001", "EI-002", "EI-003", "EI-004", "factory_narrative_package", "governance_ready"
  ]);
  assert.equal(report.finalInstitutionalDecision, "certified");
});

test("end-to-end corpus requires exact cross-stage topic lineage", () => {
  assert.throws(() => certifyEditorialEndToEndCase({
    ...editorialEndToEndTierACorpus[0]!,
    ei004CaseId: editorialEndToEndTierACorpus[1]!.ei004CaseId
  }), /Cross-topic/);
});

test("end-to-end certification persists and dispatches independently of component certification", async () => {
  const persistence = { async createReport(report: any) { return { ...report, certificationRunId: "run-e2e" }; } };
  const persisted = await editorialEndToEndCertificationService.certify({ actor: "test", persistence });
  assert.equal(persisted.certificationRunId, "run-e2e");
  const lines: string[] = [];
  assert.equal(await runEditorialCertificationCommand({
    actor: "test", scope: "end-to-end", persistence, write: (line) => lines.push(line)
  }), 0);
  const payload = JSON.parse(lines[0]!);
  assert.equal(payload.report.epic, "EI-END-TO-END");
  assert.equal(payload.report.certificationScope, "end-to-end");
});

test("CLI parses end-to-end scope and migrations register immutable persistence", () => {
  const cli = readFileSync("scripts/certify-editorial-intelligence.ts", "utf8");
  const migration = readFileSync("db/migrations/20260723_editorial_end_to_end_certification.sql", "utf8");
  const rollback = readFileSync("db/rollbacks/20260723_editorial_end_to_end_certification.sql", "utf8");
  assert.match(cli, /--scope/);
  assert.match(cli, /end-to-end/);
  assert.match(migration, /EI-END-TO-END/);
  assert.match(rollback, /EI-004/);
});
