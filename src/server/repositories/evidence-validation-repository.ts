import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";
import type {
  EvidenceValidationCheck,
  EvidenceValidationProvenance,
  EvidenceValidationRecord,
  EvidenceValidationStatus
} from "@/src/server/evidence-validation/contracts";
import type { EvidenceRecord } from "@/src/server/research-corpus/contracts";

export type EvidenceValidationSubject = EvidenceRecord & {
  corpusDocumentExists: boolean;
  sourceSnapshotExists: boolean;
  sourceRecordExists: boolean;
  corpusTextLength: number | null;
  sourceTitle: string | null;
  sourceDescription: string | null;
  sourceProvenance: Record<string, unknown> | null;
};

export type CreateEvidenceValidationRecordInput = {
  evidenceRecordId: string;
  status: EvidenceValidationStatus;
  checks: EvidenceValidationCheck[];
  provenance: EvidenceValidationProvenance;
  actor: string;
};

export const evidenceValidationRepository = {
  async getValidationRecordById(validationRecordId: string): Promise<EvidenceValidationRecord | null> {
    const [record] = await evidenceValidationRepository.getValidationRecords([validationRecordId]);
    return record || null;
  },

  async getValidationRecords(validationRecordIds: readonly string[]): Promise<EvidenceValidationRecord[]> {
    if (validationRecordIds.length === 0) return [];
    if (validationRecordIds.length > 500) {
      throw new ApiError(400, "VALIDATION_RECORD_BATCH_LIMIT_EXCEEDED", "At most 500 exact validation records may be loaded.");
    }
    const ids = [...new Set(validationRecordIds)];
    const sql = getWriteSql("loading evidence validation records by exact IDs");
    return sql<EvidenceValidationRecord[]>`
      SELECT id::text AS "validationRecordId", evidence_record_id::text AS "evidenceRecordId",
        status, checks, provenance, created_by AS "createdBy", created_at::text AS "createdAt"
      FROM evidence_validation_records
      WHERE id = ANY(${ids}::uuid[])
      ORDER BY id
      LIMIT 500
    `;
  },

  async getEvidenceSubject(evidenceRecordId: string): Promise<EvidenceValidationSubject | null> {
    const sql = getWriteSql("loading evidence record for structural validation");
    const [row] = await sql<EvidenceValidationSubject[]>`
      SELECT
        evidence_records.id::text AS "evidenceRecordId",
        evidence_records.corpus_document_id::text AS "corpusDocumentId",
        evidence_records.source_snapshot_id::text AS "sourceSnapshotId",
        evidence_records.source_record_id::text AS "sourceRecordId",
        evidence_records.provider,
        evidence_records.retrieval_timestamp::text AS "retrievalTimestamp",
        evidence_records.span_start::int AS "spanStart",
        evidence_records.span_end::int AS "spanEnd",
        evidence_records.quote_text AS "quoteText",
        evidence_records.normalized_claim AS "normalizedClaim",
        evidence_records.provenance,
        evidence_records.created_by AS "createdBy",
        evidence_records.created_at::text AS "createdAt",
        (corpus_documents.id IS NOT NULL) AS "corpusDocumentExists",
        (source_authority_snapshots.id IS NOT NULL) AS "sourceSnapshotExists",
        (source_authority_records.id IS NOT NULL) AS "sourceRecordExists",
        length(corpus_documents.normalized_text)::int AS "corpusTextLength"
        ,source_authority_records.title AS "sourceTitle"
        ,source_authority_records.description AS "sourceDescription"
        ,source_authority_records.provenance AS "sourceProvenance"
      FROM evidence_records
      LEFT JOIN corpus_documents
        ON corpus_documents.id = evidence_records.corpus_document_id
      LEFT JOIN source_authority_snapshots
        ON source_authority_snapshots.id = evidence_records.source_snapshot_id
      LEFT JOIN source_authority_records
        ON source_authority_records.id = evidence_records.source_record_id
      WHERE evidence_records.id = ${evidenceRecordId}
      LIMIT 1
    `;
    return row || null;
  },

  async requireEvidenceSubject(evidenceRecordId: string): Promise<EvidenceValidationSubject> {
    const subject = await evidenceValidationRepository.getEvidenceSubject(evidenceRecordId);
    if (!subject) {
      throw new ApiError(404, "EVIDENCE_RECORD_NOT_FOUND", "Evidence record not found.");
    }
    return subject;
  },

  async createValidationRecord(input: CreateEvidenceValidationRecordInput): Promise<EvidenceValidationRecord> {
    const sql = getWriteSql("creating evidence validation record");
    const [row] = await sql<EvidenceValidationRecord[]>`
      INSERT INTO evidence_validation_records (
        evidence_record_id,
        status,
        checks,
        provenance,
        created_by
      )
      VALUES (
        ${input.evidenceRecordId},
        ${input.status},
        ${sql.json(input.checks as any)},
        ${sql.json(input.provenance as any)},
        ${input.actor}
      )
      RETURNING
        id::text AS "validationRecordId",
        evidence_record_id::text AS "evidenceRecordId",
        status,
        checks,
        provenance,
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  }
};
