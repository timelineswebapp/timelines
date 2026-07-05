import { getWriteSql, withWriteTransaction } from "@/src/server/db/client";
import type { EditorialEvidenceSet, EditorialEvidenceSubject } from "@/src/server/editorial-intelligence/contracts";

export const editorialEvidenceRepository = {
  async getById(editorialEvidenceSetId: string): Promise<EditorialEvidenceSet | null> {
    const sql = getWriteSql("loading Editorial Evidence Set by exact ID");
    const [row] = await sql<{ payload: EditorialEvidenceSet }[]>`
      SELECT payload
      FROM factory_editorial_evidence_sets
      WHERE id = ${editorialEvidenceSetId}
      LIMIT 1
    `;
    return row ? { ...row.payload, editorialEvidenceSetId } : null;
  },

  async listValidatedEvidence(topic: string, limit = 500): Promise<EditorialEvidenceSubject[]> {
    const sql = getWriteSql("loading passed evidence for editorial preparation");
    return sql<EditorialEvidenceSubject[]>`
      SELECT jsonb_build_object(
        'evidenceRecordId', e.id::text, 'corpusDocumentId', e.corpus_document_id::text,
        'sourceSnapshotId', e.source_snapshot_id::text, 'sourceRecordId', e.source_record_id::text,
        'provider', e.provider, 'retrievalTimestamp', e.retrieval_timestamp::text,
        'spanStart', e.span_start, 'spanEnd', e.span_end, 'quoteText', e.quote_text,
        'normalizedClaim', e.normalized_claim, 'provenance', e.provenance,
        'createdBy', e.created_by, 'createdAt', e.created_at::text
      ) AS evidence, v.id::text AS "validationRecordId", v.provenance AS validation,
      s.title AS "sourceTitle",
      COALESCE((s.provenance->'relevanceAssessment'->>'authorityRelevance')::float, 0) AS "sourceAuthorityScore"
      FROM evidence_records e
      INNER JOIN LATERAL (
        SELECT id, provenance FROM evidence_validation_records
        WHERE evidence_record_id = e.id AND status = 'passed'
          AND provenance->'groundingAssessment'->>'topic' = ${topic}
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) v ON TRUE
      INNER JOIN source_authority_records s ON s.id = e.source_record_id
      ORDER BY e.id ASC
      LIMIT ${limit}
    `;
  },

  async create(set: EditorialEvidenceSet, actor: string): Promise<EditorialEvidenceSet> {
    return withWriteTransaction("persisting Factory editorial evidence set", async () => {
      const sql = getWriteSql("persisting Factory editorial evidence set");
      await sql`
        INSERT INTO factory_editorial_evidence_sets
          (topic, algorithm_version, input_fingerprint, payload, created_by)
        VALUES (${set.topic}, ${set.algorithmVersion}, ${set.inputFingerprint}, ${sql.json(set as any)}, ${actor})
        ON CONFLICT (topic, algorithm_version, input_fingerprint) DO NOTHING
      `;
      const [row] = await sql<{ editorialEvidenceSetId: string }[]>`
        SELECT id::text AS "editorialEvidenceSetId" FROM factory_editorial_evidence_sets
        WHERE topic=${set.topic} AND algorithm_version=${set.algorithmVersion}
          AND input_fingerprint=${set.inputFingerprint}
        LIMIT 1
      `;
      for (const evidence of set.rankedEvidence) {
        await sql`
          INSERT INTO factory_editorial_evidence_set_inputs
            (editorial_evidence_set_id, evidence_record_id, validation_record_id, rank, score, duplicate_of_evidence_record_id)
          VALUES (${row!.editorialEvidenceSetId}, ${evidence.evidenceRecordId}, ${evidence.validationRecordId},
            ${evidence.rank}, ${sql.json(evidence.score as any)}, ${evidence.duplicateOfEvidenceRecordId})
          ON CONFLICT (editorial_evidence_set_id, evidence_record_id) DO NOTHING
        `;
      }
      return { ...set, editorialEvidenceSetId: row!.editorialEvidenceSetId };
    });
  }
};
