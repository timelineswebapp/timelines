import { randomUUID } from "node:crypto";
import { getWriteSql, withWriteTransaction } from "@/src/server/db/client";
import type { PublishedMemoryCertificationPersistence, PublishedMemoryCertificationReport } from "@/src/server/published-memory-certification/contracts";

export const publishedMemoryCertificationRepository: PublishedMemoryCertificationPersistence = {
  async createReport(report: PublishedMemoryCertificationReport, actor: string): Promise<PublishedMemoryCertificationReport> {
    return withWriteTransaction("persisting immutable Published Memory Certification report", async () => {
      const sql = getWriteSql("persisting immutable Published Memory Certification report");
      const certificationRunId = randomUUID();
      await sql`
        INSERT INTO published_memory_certification_runs (
          id, kind, scope, framework_version, certification_version, corpus_version,
          corpus_fingerprint, status, final_verdict, boundary, subjects,
          lifecycle_statistics, publication_statistics, failure_statistics,
          determinism_results, regression_results, summary, created_by
        ) VALUES (
          ${certificationRunId}, ${report.kind}, ${report.scope}, ${report.frameworkVersion},
          ${report.certificationVersion}, ${report.corpusVersion}, ${report.corpusFingerprint},
          ${report.status}, ${report.finalVerdict}, ${sql.json(report.boundary as any)},
          ${report.subjects}, ${sql.json(report.lifecycleStatistics as any)},
          ${sql.json(report.publicationStatistics as any)}, ${sql.json(report.failureStatistics as any)},
          ${sql.json(report.determinismResults as any)}, ${sql.json(report.regressionResults as any)},
          ${sql.json(report.summary as any)}, ${actor}
        )
      `;
      for (const stage of report.stageResults) {
        await sql`
          INSERT INTO published_memory_certification_stage_results (
            certification_run_id, stage, status
          ) VALUES (${certificationRunId}, ${stage.stage}, ${stage.status})
        `;
      }
      for (const caseResult of report.caseResults) {
        const [caseRow] = await sql<{ caseResultId: string }[]>`
          INSERT INTO published_memory_certification_case_results (
            certification_run_id, case_id, subject, status, expected_fingerprint,
            actual_fingerprint, exact_input
          ) VALUES (
            ${certificationRunId}, ${caseResult.caseId}, ${caseResult.subject},
            ${caseResult.status}, ${caseResult.expectedFingerprint}, ${caseResult.actualFingerprint},
            ${sql.json(caseResult.exactInput as any)}
          )
          RETURNING id::text AS "caseResultId"
        `;
        for (const lifecycle of caseResult.lifecycleResults) {
          await sql`
            INSERT INTO published_memory_certification_lifecycle_results (
              case_result_id, operation, passed, lineage_verified, audit_verified
            ) VALUES (
              ${caseRow!.caseResultId}, ${lifecycle.operation}, ${lifecycle.passed},
              ${lifecycle.lineageVerified}, ${lifecycle.auditVerified}
            )
          `;
        }
        for (const failure of caseResult.failureInjectionResults) {
          await sql`
            INSERT INTO published_memory_certification_failure_results (
              case_result_id, failure_key, passed, expected, actual, message
            ) VALUES (
              ${caseRow!.caseResultId}, ${failure.failureKey}, ${failure.passed},
              ${failure.expected}, ${failure.actual}, ${failure.message}
            )
          `;
        }
        for (const invariant of caseResult.invariants) {
          await sql`
            INSERT INTO published_memory_certification_invariant_results (
              case_result_id, invariant_key, passed, expected, actual, message
            ) VALUES (
              ${caseRow!.caseResultId}, ${invariant.invariantKey}, ${invariant.passed},
              ${sql.json(invariant.expected as any)}, ${sql.json(invariant.actual as any)}, ${invariant.message}
            )
          `;
        }
      }
      return { ...report, certificationRunId };
    });
  }
};
