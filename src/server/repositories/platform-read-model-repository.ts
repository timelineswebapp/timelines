import { getSql } from "@/src/server/db/client";
import type { PublishedReadModelSnapshot, PublishedReadModelType } from "@/src/server/platform/read-model-contracts";
import { publishedMemoryProjectionRepository } from "@/src/server/repositories/published-memory-projection-repository";

type PublishedReadModelRow = {
  snapshotId: string;
  authorityRef: PublishedReadModelSnapshot["authorityRef"];
  snapshot: Record<string, unknown>;
  lifecycle: "active" | "preserved";
  createdAt?: string;
};

function toReadModel(row: PublishedReadModelRow): PublishedReadModelSnapshot | null {
  const readModelType = row.snapshot.readModelType;
  const payload = row.snapshot.payload;
  if (typeof readModelType !== "string" || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  return {
    snapshotId: row.snapshotId,
    authorityRef: row.authorityRef,
    readModelType: readModelType as PublishedReadModelType,
    slug: typeof row.snapshot.slug === "string" ? row.snapshot.slug : null,
    payload: payload as Record<string, unknown>,
    createdAt: row.createdAt
  };
}

async function listPublishedReadModels(type: PublishedReadModelType, limit: number): Promise<PublishedReadModelSnapshot[]> {
  const projections = await publishedMemoryProjectionRepository.listActiveProjections(type, limit);
  if (projections.length > 0) {
    return projections.map((projection) => ({
      snapshotId: projection.publishedSnapshotId,
      authorityRef: {
        authorityType: projection.projectionType,
        authorityId: projection.publishedSnapshotId
      },
      readModelType: projection.projectionType,
      slug: projection.slug,
      payload: projection.payload,
      createdAt: projection.createdAt
    }));
  }

  const sql = getSql();
  if (!sql) {
    return [];
  }

  const rows = await sql<PublishedReadModelRow[]>`
    SELECT
      id::text AS "snapshotId",
      authority_ref AS "authorityRef",
      snapshot,
      lifecycle,
      created_at::text AS "createdAt"
    FROM historical_library_published_snapshots
    WHERE lifecycle = 'active'
      AND snapshot->>'readModelType' = ${type}
      AND NOT EXISTS (
        SELECT 1
        FROM historical_library_retirements
        WHERE historical_library_retirements.published_snapshot_id = historical_library_published_snapshots.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM historical_library_merges
        WHERE historical_library_merges.source_published_record_id = historical_library_published_snapshots.id
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map(toReadModel).filter((item): item is PublishedReadModelSnapshot => Boolean(item));
}

export const platformReadModelRepository = {
  listPublishedReadModels,

  async getPublishedReadModelBySlug(type: PublishedReadModelType, slug: string): Promise<PublishedReadModelSnapshot | null> {
    const sql = getSql();
    if (!sql) {
      return null;
    }

    const [row] = await sql<PublishedReadModelRow[]>`
      SELECT
        id::text AS "snapshotId",
        authority_ref AS "authorityRef",
        snapshot,
        lifecycle,
        created_at::text AS "createdAt"
      FROM historical_library_published_snapshots
      WHERE lifecycle = 'active'
        AND snapshot->>'readModelType' = ${type}
        AND snapshot->>'slug' = ${slug}
        AND NOT EXISTS (
          SELECT 1
          FROM historical_library_retirements
          WHERE historical_library_retirements.published_snapshot_id = historical_library_published_snapshots.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM historical_library_merges
          WHERE historical_library_merges.source_published_record_id = historical_library_published_snapshots.id
        )
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return row ? toReadModel(row) : null;
  },

  async getMergeContinuity(sourcePublishedRecordId: string) {
    const sql = getSql();
    if (!sql) {
      return null;
    }

    const [row] = await sql<Array<{
      sourcePublishedRecordId: string;
      targetPublishedRecordId: string;
      continuityPath: Record<string, unknown>;
    }>>`
      SELECT
        source_published_record_id::text AS "sourcePublishedRecordId",
        target_published_record_id::text AS "targetPublishedRecordId",
        continuity_path AS "continuityPath"
      FROM historical_library_merges
      WHERE source_published_record_id = ${sourcePublishedRecordId}
      LIMIT 1
    `;
    return row || null;
  },

  async getRetirementContinuity(publishedSnapshotId: string) {
    const sql = getSql();
    if (!sql) {
      return null;
    }

    const [row] = await sql<Array<{
      sourcePublishedRecordId: string;
      continuityPath: Record<string, unknown>;
    }>>`
      SELECT
        published_snapshot_id::text AS "sourcePublishedRecordId",
        continuity_path AS "continuityPath"
      FROM historical_library_retirements
      WHERE published_snapshot_id = ${publishedSnapshotId}
      LIMIT 1
    `;
    return row || null;
  }
};
