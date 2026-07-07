import { randomUUID } from "node:crypto";
import { getWriteSql, withWriteTransaction } from "@/src/server/db/client";
import type {
  EditorialCertificationPersistence,
  EditorialCertificationReport
} from "@/src/server/editorial-certification/contracts";
import type { Ei003CertificationReport } from "@/src/server/editorial-certification/ei003-contracts";
import type { Ei004CertificationReport } from "@/src/server/editorial-certification/ei004-contracts";
import type { EditorialEndToEndCertificationReport } from "@/src/server/editorial-certification/end-to-end-contracts";

export const editorialCertificationRepository: EditorialCertificationPersistence = {
  async createReport<T extends EditorialCertificationReport | Ei003CertificationReport | Ei004CertificationReport | EditorialEndToEndCertificationReport>(
    report: T,
    actor: string
  ): Promise<T> {
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
        const isComposition = report.epic === "EI-003";
        const isWriter = report.epic === "EI-004";
        const isEndToEnd = report.epic === "EI-END-TO-END";
        const compositionCase = isComposition ? caseResult : null;
        const [caseRow] = await sql<{ caseResultId: string }[]>`
          INSERT INTO factory_editorial_certification_case_results (
            certification_run_id, case_id, topic, status, compiler_version,
            selection_algorithm_version, expected_fingerprint, actual_fingerprint,
            exact_input, actual_output, planner_version, structure_algorithm_version,
            input_fingerprint, output_fingerprint, writer_version, generation_algorithm_version,
            execution_key, narrative_id, revision_identity, prompt_fingerprints,
            policy_fingerprint, provider_fingerprint
          ) VALUES (
            ${certificationRunId}, ${caseResult.caseId}, ${caseResult.topic}, ${caseResult.status},
            ${isComposition || isWriter || isEndToEnd ? "not_applicable" : (caseResult as any).compilerVersion},
            ${isComposition || isWriter || isEndToEnd ? "not_applicable" : (caseResult as any).selectionAlgorithmVersion},
            ${caseResult.expectedFingerprint}, ${caseResult.actualFingerprint},
            ${sql.json(caseResult.exactInput as any)},
            ${sql.json(((caseResult as any).actualCompilerOutput || (caseResult as any).actualCompositionOutput || (caseResult as any).actualNarrativeOutput || (caseResult as any).actualOutput || {}) as any)},
            ${isComposition ? (compositionCase as any).plannerVersion : null},
            ${isComposition ? (compositionCase as any).structureAlgorithmVersion : null},
            ${isComposition ? (compositionCase as any).actualFingerprint : null},
            ${isComposition ? (compositionCase as any).actualOutputFingerprint : isWriter ? (caseResult as any).actualOutputFingerprint : null},
            ${isWriter ? (caseResult as any).writerVersion : null},
            ${isWriter ? (caseResult as any).generationAlgorithmVersion : null},
            ${isWriter ? (caseResult as any).exactInput.executionKey : null},
            ${isWriter ? (caseResult as any).exactInput.narrative.narrativeId : null},
            ${isWriter ? sql.json((caseResult as any).exactInput.observedRevision) : null},
            ${isWriter ? (caseResult as any).exactInput.promptFingerprints : null},
            ${isWriter ? (caseResult as any).exactInput.policyFingerprint : null},
            ${isWriter ? (caseResult as any).exactInput.providerFingerprint : null}
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
