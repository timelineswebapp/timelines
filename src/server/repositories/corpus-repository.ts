import { createHash } from "node:crypto";
import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";
import type { SourceAuthoritySnapshot } from "@/src/server/source-authority/contracts";
import type { CorpusDocument, CorpusSourceLineage } from "@/src/server/research-corpus/contracts";

export type SourceSnapshotWithRecord = SourceAuthoritySnapshot & {
  sourceTitle: string;
  sourceDescription: string | null;
  provider: CorpusSourceLineage["provider"];
};

export type CreateCorpusDocumentInput = {
  snapshot: SourceSnapshotWithRecord;
  normalizedText: string;
  actor: string;
};

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export const corpusRepository = {
  async getSourceSnapshot(sourceSnapshotId: string): Promise<SourceSnapshotWithRecord | null> {
    const sql = getWriteSql("loading source snapshot for corpus generation");
    const [row] = await sql<SourceSnapshotWithRecord[]>`
      SELECT
        source_authority_snapshots.id::text AS "snapshotId",
        source_authority_snapshots.source_record_id::text AS "sourceRecordId",
        source_authority_snapshots.version::int,
        source_authority_snapshots.retrieval_url AS "retrievalUrl",
        source_authority_snapshots.content_type AS "contentType",
        source_authority_snapshots.content_hash AS "contentHash",
        source_authority_snapshots.content_text AS "contentText",
        source_authority_snapshots.raw_metadata AS "rawMetadata",
        source_authority_snapshots.provenance,
        source_authority_snapshots.retrieved_by AS "retrievedBy",
        source_authority_snapshots.retrieved_at::text AS "retrievedAt",
        source_authority_records.title AS "sourceTitle",
        source_authority_records.description AS "sourceDescription",
        source_authority_records.provider
      FROM source_authority_snapshots
      INNER JOIN source_authority_records
        ON source_authority_records.id = source_authority_snapshots.source_record_id
      WHERE source_authority_snapshots.id = ${sourceSnapshotId}
      LIMIT 1
    `;
    return row || null;
  },

  async requireSourceSnapshot(sourceSnapshotId: string): Promise<SourceSnapshotWithRecord> {
    const snapshot = await corpusRepository.getSourceSnapshot(sourceSnapshotId);
    if (!snapshot) {
      throw new ApiError(404, "SOURCE_SNAPSHOT_NOT_FOUND", "Source snapshot not found.");
    }
    return snapshot;
  },

  async createDocument(input: CreateCorpusDocumentInput): Promise<CorpusDocument> {
    const sql = getWriteSql("creating corpus document");
    const retrievalTimestamp = input.snapshot.provenance.retrievedAt || input.snapshot.retrievedAt || new Date(0).toISOString();
    const sourceLineage: CorpusSourceLineage = {
      sourceSnapshotId: input.snapshot.snapshotId,
      sourceRecordId: input.snapshot.sourceRecordId,
      provider: input.snapshot.provider,
      retrievalTimestamp,
      snapshotVersion: input.snapshot.version,
      retrievalUrl: input.snapshot.retrievalUrl,
      retrievalProvenance: input.snapshot.provenance
    };
    const [row] = await sql<CorpusDocument[]>`
      INSERT INTO corpus_documents (
        source_snapshot_id,
        source_record_id,
        provider,
        title,
        content_type,
        normalized_text,
        content_hash,
        source_lineage,
        created_by
      )
      VALUES (
        ${input.snapshot.snapshotId},
        ${input.snapshot.sourceRecordId},
        ${input.snapshot.provider},
        ${input.snapshot.sourceTitle},
        ${input.snapshot.contentType},
        ${input.normalizedText},
        ${hashText(input.normalizedText)},
        ${sql.json(sourceLineage as any)},
        ${input.actor}
      )
      ON CONFLICT (source_snapshot_id) DO NOTHING
      RETURNING
        id::text AS "corpusDocumentId",
        source_snapshot_id::text AS "sourceSnapshotId",
        source_record_id::text AS "sourceRecordId",
        provider,
        title,
        content_type AS "contentType",
        normalized_text AS "normalizedText",
        content_hash AS "contentHash",
        source_lineage AS "sourceLineage",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    if (row) {
      return row;
    }

    const [existing] = await sql<CorpusDocument[]>`
      SELECT
        id::text AS "corpusDocumentId",
        source_snapshot_id::text AS "sourceSnapshotId",
        source_record_id::text AS "sourceRecordId",
        provider,
        title,
        content_type AS "contentType",
        normalized_text AS "normalizedText",
        content_hash AS "contentHash",
        source_lineage AS "sourceLineage",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM corpus_documents
      WHERE source_snapshot_id = ${input.snapshot.snapshotId}
      LIMIT 1
    `;
    return existing!;
  },

  async getDocument(corpusDocumentId: string): Promise<CorpusDocument | null> {
    const sql = getWriteSql("loading corpus document");
    const [row] = await sql<CorpusDocument[]>`
      SELECT
        id::text AS "corpusDocumentId",
        source_snapshot_id::text AS "sourceSnapshotId",
        source_record_id::text AS "sourceRecordId",
        provider,
        title,
        content_type AS "contentType",
        normalized_text AS "normalizedText",
        content_hash AS "contentHash",
        source_lineage AS "sourceLineage",
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM corpus_documents
      WHERE id = ${corpusDocumentId}
      LIMIT 1
    `;
    return row || null;
  },

  async requireDocument(corpusDocumentId: string): Promise<CorpusDocument> {
    const document = await corpusRepository.getDocument(corpusDocumentId);
    if (!document) {
      throw new ApiError(404, "CORPUS_DOCUMENT_NOT_FOUND", "Corpus document not found.");
    }
    return document;
  }
};
