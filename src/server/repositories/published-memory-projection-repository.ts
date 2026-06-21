import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { getSql, getWriteSql } from "@/src/server/db/client";
import type { PublishedReadModelType } from "@/src/server/platform/read-model-contracts";

export type PublishedMemoryProjectionLifecycle = "active" | "superseded" | "retired" | "merged" | "preserved";
export type PublishedMemoryProjectionEvent = "admission" | "revision" | "retirement" | "merge" | "preservation" | "rebuild";

export type PublishedMemoryProjection = {
  projectionId: string;
  publishedSnapshotId: string;
  projectionType: PublishedReadModelType;
  slug: string | null;
  payload: Record<string, unknown>;
  projectionVersion: number;
  projectionHash: string;
  lifecycle: PublishedMemoryProjectionLifecycle;
  sourceEventType: PublishedMemoryProjectionEvent;
  sourceEventId: string;
  auditRecordId: string | null;
  createdAt?: string;
};

export type PublishedMemoryContinuityProjection = {
  continuityProjectionId: string;
  sourcePublishedSnapshotId: string;
  targetPublishedSnapshotId: string | null;
  continuityType: "retired" | "merged";
  continuityPath: Record<string, unknown>;
  sourceEventId: string;
  projectionHash: string;
  auditRecordId: string | null;
  createdAt?: string;
};

export type UpsertProjectionInput = {
  publishedSnapshotId: string;
  projectionType: PublishedReadModelType;
  slug?: string | null;
  payload: Record<string, unknown>;
  lifecycle?: PublishedMemoryProjectionLifecycle;
  sourceEventType: PublishedMemoryProjectionEvent;
  sourceEventId: string;
  auditRecordId?: string | null;
  lineage?: {
    revisionId?: string | null;
    retirementId?: string | null;
    mergeId?: string | null;
    preservationId?: string | null;
  };
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashProjection(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

async function nextProjectionVersion(sql: Sql, publishedSnapshotId: string, projectionType: PublishedReadModelType): Promise<number> {
  const [row] = await sql<Array<{ version: number }>>`
    SELECT COALESCE(MAX(projection_version), 0)::int + 1 AS version
    FROM published_memory_projections
    WHERE published_snapshot_id = ${publishedSnapshotId}
      AND projection_type = ${projectionType}
  `;
  return row?.version || 1;
}

export const publishedMemoryProjectionRepository = {
  async upsertProjection(input: UpsertProjectionInput): Promise<PublishedMemoryProjection> {
    const sql = getWriteSql("upserting published memory projection");
    const projectionHash = hashProjection(input.payload);

    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      const projectionVersion = await nextProjectionVersion(tx, input.publishedSnapshotId, input.projectionType);
      const [projection] = await tx<PublishedMemoryProjection[]>`
        INSERT INTO published_memory_projections (
          published_snapshot_id,
          projection_type,
          slug,
          payload,
          projection_version,
          projection_hash,
          lifecycle,
          source_event_type,
          source_event_id,
          audit_record_id
        )
        VALUES (
          ${input.publishedSnapshotId},
          ${input.projectionType},
          ${input.slug || null},
          ${tx.json(input.payload as any)},
          ${projectionVersion},
          ${projectionHash},
          ${input.lifecycle || "active"},
          ${input.sourceEventType},
          ${input.sourceEventId},
          ${input.auditRecordId || null}
        )
        ON CONFLICT (published_snapshot_id, projection_type, projection_hash) DO UPDATE
        SET lifecycle = EXCLUDED.lifecycle,
            source_event_type = EXCLUDED.source_event_type,
            source_event_id = EXCLUDED.source_event_id,
            audit_record_id = COALESCE(EXCLUDED.audit_record_id, published_memory_projections.audit_record_id)
        RETURNING
          id::text AS "projectionId",
          published_snapshot_id::text AS "publishedSnapshotId",
          projection_type AS "projectionType",
          slug,
          payload,
          projection_version::int AS "projectionVersion",
          projection_hash AS "projectionHash",
          lifecycle,
          source_event_type AS "sourceEventType",
          source_event_id::text AS "sourceEventId",
          audit_record_id::text AS "auditRecordId",
          created_at::text AS "createdAt"
      `;

      await tx`
        INSERT INTO published_memory_projection_lineage (
          projection_id,
          published_snapshot_id,
          revision_id,
          retirement_id,
          merge_id,
          preservation_id,
          projection_version,
          projection_hash,
          audit_record_id
        )
        VALUES (
          ${projection!.projectionId},
          ${input.publishedSnapshotId},
          ${input.lineage?.revisionId || null},
          ${input.lineage?.retirementId || null},
          ${input.lineage?.mergeId || null},
          ${input.lineage?.preservationId || null},
          ${projection!.projectionVersion},
          ${projection!.projectionHash},
          ${input.auditRecordId || null}
        )
        ON CONFLICT DO NOTHING
      `;

      return projection!;
    });
  },

  async upsertContinuityProjection(input: {
    sourcePublishedSnapshotId: string;
    targetPublishedSnapshotId?: string | null;
    continuityType: "retired" | "merged";
    continuityPath: Record<string, unknown>;
    sourceEventId: string;
    auditRecordId?: string | null;
  }): Promise<PublishedMemoryContinuityProjection> {
    const sql = getWriteSql("upserting published memory continuity projection");
    const projectionHash = hashProjection({
      sourcePublishedSnapshotId: input.sourcePublishedSnapshotId,
      targetPublishedSnapshotId: input.targetPublishedSnapshotId || null,
      continuityType: input.continuityType,
      continuityPath: input.continuityPath
    });
    const [row] = await sql<PublishedMemoryContinuityProjection[]>`
      INSERT INTO published_memory_continuity_projections (
        source_published_snapshot_id,
        target_published_snapshot_id,
        continuity_type,
        continuity_path,
        source_event_id,
        projection_hash,
        audit_record_id
      )
      VALUES (
        ${input.sourcePublishedSnapshotId},
        ${input.targetPublishedSnapshotId || null},
        ${input.continuityType},
        ${sql.json(input.continuityPath as any)},
        ${input.sourceEventId},
        ${projectionHash},
        ${input.auditRecordId || null}
      )
      ON CONFLICT (source_published_snapshot_id, continuity_type, projection_hash) DO UPDATE
      SET audit_record_id = COALESCE(EXCLUDED.audit_record_id, published_memory_continuity_projections.audit_record_id)
      RETURNING
        id::text AS "continuityProjectionId",
        source_published_snapshot_id::text AS "sourcePublishedSnapshotId",
        target_published_snapshot_id::text AS "targetPublishedSnapshotId",
        continuity_type AS "continuityType",
        continuity_path AS "continuityPath",
        source_event_id::text AS "sourceEventId",
        projection_hash AS "projectionHash",
        audit_record_id::text AS "auditRecordId",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async listActiveProjections(type: PublishedReadModelType, limit: number): Promise<PublishedMemoryProjection[]> {
    const sql = getSql();
    if (!sql) {
      return [];
    }
    return sql<PublishedMemoryProjection[]>`
      SELECT
        id::text AS "projectionId",
        published_snapshot_id::text AS "publishedSnapshotId",
        projection_type AS "projectionType",
        slug,
        payload,
        projection_version::int AS "projectionVersion",
        projection_hash AS "projectionHash",
        lifecycle,
        source_event_type AS "sourceEventType",
        source_event_id::text AS "sourceEventId",
        audit_record_id::text AS "auditRecordId",
        created_at::text AS "createdAt"
      FROM published_memory_projections
      WHERE projection_type = ${type}
        AND lifecycle = 'active'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }
};
