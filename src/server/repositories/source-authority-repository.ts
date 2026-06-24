import { createHash } from "node:crypto";
import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";
import type {
  SourceAuthorityProvider,
  SourceAuthorityRegistryRecord,
  SourceAuthoritySnapshot,
  SourceDiscoveryResult,
  SourceRetrievalProvenance
} from "@/src/server/source-authority/contracts";

export type RegisterSourceInput = {
  discovery: SourceDiscoveryResult;
  query: string;
  actor: string;
};

export type CreateSourceSnapshotInput = {
  sourceRecord: SourceAuthorityRegistryRecord;
  retrievalUrl: string;
  contentType: string;
  contentText: string;
  rawMetadata: Record<string, unknown>;
  provenance: SourceRetrievalProvenance;
  actor: string;
};

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export const sourceAuthorityRepository = {
  async registerDiscoveredSource(input: RegisterSourceInput): Promise<SourceAuthorityRegistryRecord> {
    const sql = getWriteSql("registering discovered source authority record");
    const discoveredAt = new Date().toISOString();
    const origin = {
      provider: input.discovery.provider,
      providerRecordId: input.discovery.providerRecordId,
      providerUrl: input.discovery.originUrl,
      discoveredFromQuery: input.query,
      discoveredAt
    };

    const [row] = await sql<SourceAuthorityRegistryRecord[]>`
      INSERT INTO source_authority_records (
        provider,
        provider_record_id,
        canonical_url,
        title,
        description,
        source_type,
        origin,
        provenance,
        created_by
      )
      VALUES (
        ${input.discovery.provider},
        ${input.discovery.providerRecordId},
        ${input.discovery.canonicalUrl},
        ${input.discovery.title},
        ${input.discovery.description},
        ${input.discovery.sourceType},
        ${sql.json(origin as any)},
        ${sql.json({ discovery: input.discovery.raw } as any)},
        ${input.actor}
      )
      ON CONFLICT (provider, provider_record_id) DO UPDATE
      SET canonical_url = EXCLUDED.canonical_url,
          origin = EXCLUDED.origin,
          provenance = source_authority_records.provenance || EXCLUDED.provenance
      RETURNING
        id::text AS "sourceRecordId",
        provider,
        provider_record_id AS "providerRecordId",
        canonical_url AS "canonicalUrl",
        title,
        description,
        source_type AS "sourceType",
        origin,
        provenance,
        created_by AS "createdBy",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async getSourceRecord(sourceRecordId: string): Promise<SourceAuthorityRegistryRecord | null> {
    const sql = getWriteSql("loading source authority record");
    const [row] = await sql<SourceAuthorityRegistryRecord[]>`
      SELECT
        id::text AS "sourceRecordId",
        provider,
        provider_record_id AS "providerRecordId",
        canonical_url AS "canonicalUrl",
        title,
        description,
        source_type AS "sourceType",
        origin,
        provenance,
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM source_authority_records
      WHERE id = ${sourceRecordId}
      LIMIT 1
    `;
    return row || null;
  },

  async createSnapshot(input: CreateSourceSnapshotInput): Promise<SourceAuthoritySnapshot> {
    const sql = getWriteSql("creating source authority snapshot");
    const contentHash = hashContent(input.contentText);
    const [latest] = await sql<Array<{ version: number }>>`
      SELECT version::int
      FROM source_authority_snapshots
      WHERE source_record_id = ${input.sourceRecord.sourceRecordId}
      ORDER BY version DESC
      LIMIT 1
    `;
    const version = (latest?.version || 0) + 1;

    const [row] = await sql<SourceAuthoritySnapshot[]>`
      INSERT INTO source_authority_snapshots (
        source_record_id,
        version,
        retrieval_url,
        content_type,
        content_hash,
        content_text,
        raw_metadata,
        provenance,
        retrieved_by
      )
      VALUES (
        ${input.sourceRecord.sourceRecordId},
        ${version},
        ${input.retrievalUrl},
        ${input.contentType},
        ${contentHash},
        ${input.contentText},
        ${sql.json(input.rawMetadata as any)},
        ${sql.json(input.provenance as any)},
        ${input.actor}
      )
      RETURNING
        id::text AS "snapshotId",
        source_record_id::text AS "sourceRecordId",
        version::int,
        retrieval_url AS "retrievalUrl",
        content_type AS "contentType",
        content_hash AS "contentHash",
        content_text AS "contentText",
        raw_metadata AS "rawMetadata",
        provenance,
        retrieved_by AS "retrievedBy",
        retrieved_at::text AS "retrievedAt"
    `;
    return row!;
  },

  async getLatestSnapshot(sourceRecordId: string): Promise<SourceAuthoritySnapshot | null> {
    const sql = getWriteSql("loading latest source authority snapshot");
    const [row] = await sql<SourceAuthoritySnapshot[]>`
      SELECT
        id::text AS "snapshotId",
        source_record_id::text AS "sourceRecordId",
        version::int,
        retrieval_url AS "retrievalUrl",
        content_type AS "contentType",
        content_hash AS "contentHash",
        content_text AS "contentText",
        raw_metadata AS "rawMetadata",
        provenance,
        retrieved_by AS "retrievedBy",
        retrieved_at::text AS "retrievedAt"
      FROM source_authority_snapshots
      WHERE source_record_id = ${sourceRecordId}
      ORDER BY version DESC
      LIMIT 1
    `;
    return row || null;
  },

  async listSourcesByProvider(provider: SourceAuthorityProvider, limit = 50): Promise<SourceAuthorityRegistryRecord[]> {
    const sql = getWriteSql("listing source authority records");
    return sql<SourceAuthorityRegistryRecord[]>`
      SELECT
        id::text AS "sourceRecordId",
        provider,
        provider_record_id AS "providerRecordId",
        canonical_url AS "canonicalUrl",
        title,
        description,
        source_type AS "sourceType",
        origin,
        provenance,
        created_by AS "createdBy",
        created_at::text AS "createdAt"
      FROM source_authority_records
      WHERE provider = ${provider}
      ORDER BY created_at DESC
      LIMIT ${Math.min(Math.max(limit, 1), 100)}
    `;
  },

  async requireSourceRecord(sourceRecordId: string): Promise<SourceAuthorityRegistryRecord> {
    const sourceRecord = await sourceAuthorityRepository.getSourceRecord(sourceRecordId);
    if (!sourceRecord) {
      throw new ApiError(404, "SOURCE_AUTHORITY_RECORD_NOT_FOUND", "Source authority record not found.");
    }
    return sourceRecord;
  }
};
