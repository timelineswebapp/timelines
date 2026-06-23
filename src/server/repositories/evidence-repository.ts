import { getWriteSql } from "@/src/server/db/client";
import type { CorpusDocument, EvidenceProvenance, EvidenceRecord } from "@/src/server/research-corpus/contracts";
import type { SourceRetrievalProvenance } from "@/src/server/source-authority/contracts";

export type CreateEvidenceRecordInput = {
  corpusDocument: CorpusDocument;
  spanStart: number;
  spanEnd: number;
  quoteText: string;
  normalizedClaim: string;
  retrievalProvenance: SourceRetrievalProvenance;
  actor: string;
};

export const evidenceRepository = {
  async createRecords(inputs: CreateEvidenceRecordInput[]): Promise<EvidenceRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    const sql = getWriteSql("creating evidence records");
    const rows: EvidenceRecord[] = [];
    for (const input of inputs) {
      const provenance: EvidenceProvenance = {
        corpusDocumentId: input.corpusDocument.corpusDocumentId,
        sourceSnapshotId: input.corpusDocument.sourceSnapshotId,
        sourceRecordId: input.corpusDocument.sourceRecordId,
        provider: input.corpusDocument.provider,
        retrievalTimestamp: input.corpusDocument.sourceLineage.retrievalTimestamp,
        retrievalProvenance: input.retrievalProvenance
      };
      const [row] = await sql<EvidenceRecord[]>`
        INSERT INTO evidence_records (
          corpus_document_id,
          source_snapshot_id,
          source_record_id,
          provider,
          retrieval_timestamp,
          span_start,
          span_end,
          quote_text,
          normalized_claim,
          provenance,
          created_by
        )
        VALUES (
          ${input.corpusDocument.corpusDocumentId},
          ${input.corpusDocument.sourceSnapshotId},
          ${input.corpusDocument.sourceRecordId},
          ${input.corpusDocument.provider},
          ${input.corpusDocument.sourceLineage.retrievalTimestamp},
          ${input.spanStart},
          ${input.spanEnd},
          ${input.quoteText},
          ${input.normalizedClaim},
          ${sql.json(provenance as any)},
          ${input.actor}
        )
        ON CONFLICT (corpus_document_id, span_start, span_end, quote_text) DO NOTHING
        RETURNING
          id::text AS "evidenceRecordId",
          corpus_document_id::text AS "corpusDocumentId",
          source_snapshot_id::text AS "sourceSnapshotId",
          source_record_id::text AS "sourceRecordId",
          provider,
          retrieval_timestamp::text AS "retrievalTimestamp",
          span_start::int AS "spanStart",
          span_end::int AS "spanEnd",
          quote_text AS "quoteText",
          normalized_claim AS "normalizedClaim",
          provenance,
          created_by AS "createdBy",
          created_at::text AS "createdAt"
      `;
      if (row) {
        rows.push(row);
        continue;
      }

      const [existing] = await sql<EvidenceRecord[]>`
        SELECT
          id::text AS "evidenceRecordId",
          corpus_document_id::text AS "corpusDocumentId",
          source_snapshot_id::text AS "sourceSnapshotId",
          source_record_id::text AS "sourceRecordId",
          provider,
          retrieval_timestamp::text AS "retrievalTimestamp",
          span_start::int AS "spanStart",
          span_end::int AS "spanEnd",
          quote_text AS "quoteText",
          normalized_claim AS "normalizedClaim",
          provenance,
          created_by AS "createdBy",
          created_at::text AS "createdAt"
        FROM evidence_records
        WHERE corpus_document_id = ${input.corpusDocument.corpusDocumentId}
          AND span_start = ${input.spanStart}
          AND span_end = ${input.spanEnd}
          AND quote_text = ${input.quoteText}
        LIMIT 1
      `;
      rows.push(existing!);
    }
    return rows;
  },

  async listByCorpusDocument(corpusDocumentId: string, limit = 100): Promise<EvidenceRecord[]> {
    const sql = getWriteSql("listing evidence records by corpus document");
    return sql<EvidenceRecord[]>`
      SELECT
        id::text AS "evidenceRecordId",
        corpus_document_id::text AS "corpusDocumentId",
        source_snapshot_id::text AS "sourceSnapshotId",
        source_record_id::text AS "sourceRecordId",
        provider,
        retrieval_timestamp::text AS "retrievalTimestamp",
        span_start::int AS "spanStart",
        span_end::int AS "spanEnd",
        quote_text AS "quoteText",
        normalized_claim AS "normalizedClaim",
        provenance,
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM evidence_records
      WHERE corpus_document_id = ${corpusDocumentId}
      ORDER BY span_start ASC
      LIMIT ${Math.min(Math.max(limit, 1), 500)}
    `;
  }
};
