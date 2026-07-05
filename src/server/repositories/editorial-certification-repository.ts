import { randomUUID } from "node:crypto";
import { getWriteSql, withWriteTransaction } from "@/src/server/db/client";
import type {
  EditorialCertificationPersistence,
  EditorialCertificationReport
} from "@/src/server/editorial-certification/contracts";

export const editorialCertificationRepository: EditorialCertificationPersistence = {
  async createReport(report: EditorialCertificationReport, actor: string): Promise<EditorialCertificationReport> {
    return withWriteTransaction("persisting immutable Editorial Certification report", async () => {
      const sql = getWriteSql("persisting immutable Editorial Certification report");
      const certificationRunId = randomUUID();
      await sql`
        INSERT INTO factory_editorial_certification_runs (
          id, epic, framework_version, corpus_version, corpus_fingerprint, status,
          authority_decision, publication_readiness_decision, summary, created_by
        ) VALUES (
          ${certificationRunId}, ${report.epic}, ${report.frameworkVersion}, ${report.corpusVersion},
          ${report.corpusFingerprint}, ${report.status}, ${report.authorityDecision},
          ${report.publicationReadinessDecision}, ${sql.json(report.summary as any)}, ${actor}
        )
      `;
      for (const caseResult of report.caseResults) {
        const [caseRow] = await sql<{ caseResultId: string }[]>`
          INSERT INTO factory_editorial_certification_case_results (
            certification_run_id, case_id, topic, status, compiler_version,
            selection_algorithm_version, expected_fingerprint, actual_fingerprint,
            exact_input, actual_output
          ) VALUES (
            ${certificationRunId}, ${caseResult.caseId}, ${caseResult.topic}, ${caseResult.status},
            ${caseResult.compilerVersion}, ${caseResult.selectionAlgorithmVersion},
            ${caseResult.expectedFingerprint}, ${caseResult.actualFingerprint},
            ${sql.json(caseResult.exactInput as any)}, ${sql.json((caseResult.actualCompilerOutput || {}) as any)}
          )
          RETURNING id::text AS "caseResultId"
        `;
        const rows = caseResult.invariants.map((item) => ({
          invariant_key: item.invariantKey,
          passed: item.passed,
          expected: item.expected,
          actual: item.actual,
          message: item.message
        }));
        await sql`
          INSERT INTO factory_editorial_certification_invariant_results (
            case_result_id, invariant_key, passed, expected, actual, message
          )
          SELECT ${caseRow!.caseResultId}, record.invariant_key, record.passed,
            record.expected, record.actual, record.message
          FROM jsonb_to_recordset(${sql.json(rows as any)})
            AS record(invariant_key text, passed boolean, expected jsonb, actual jsonb, message text)
        `;
      }
      return { ...report, certificationRunId };
    });
  }
};

