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
  supersededByProjectionId?: string | null;
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

export type ProjectionCoverageMetrics = {
  publishedSnapshotCount: number;
  projectionCountByType: Record<PublishedReadModelType, number>;
  searchProjectionCount: number;
  sitemapProjectionCount: number;
  continuityProjectionCount: number;
  activeProjectedSnapshotCount: number;
  projectionCoveragePercentage: number;
  relationshipProjectionCount: number;
  relationshipPublishedSnapshotCount: number;
  relationshipActiveProjectedSnapshotCount: number;
  relationshipProjectionCoverage: number;
  relationshipProjectionFailures: number;
  relationshipDtoFailures: number;
  relationshipContinuityProjectionCount: number;
};

export type ProjectionRebuildReportInput = {
  status: "completed" | "completed_with_failures" | "failed";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  batchSize: number;
  totalProcessed: number;
  generated: number;
  updated: number;
  unchanged: number;
  failed: number;
  skipped: number;
  continuityProjectionCount: number;
  coverageSummary: ProjectionCoverageMetrics;
  dtoValidationFailures: Array<Record<string, unknown>>;
  rebuildFailures: Array<Record<string, unknown>>;
};

export type ProjectionRebuildReport = ProjectionRebuildReportInput & {
  reportId: string;
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
  async supersedeOtherAdmissionTimelines(admissionId: string, anchorSnapshotId: string): Promise<number> {
    const sql = getWriteSql("reconciling deterministic admission timeline projection");
    const rows = await sql<Array<{ projectionId: string }>>`
      UPDATE published_memory_projections AS projection
      SET lifecycle = 'superseded'
      FROM historical_library_published_snapshots AS snapshot
      WHERE projection.published_snapshot_id = snapshot.id
        AND snapshot.admission_id = ${admissionId}
        AND projection.published_snapshot_id <> ${anchorSnapshotId}
        AND projection.projection_type = 'timeline'
        AND projection.lifecycle = 'active'
      RETURNING projection.id::text AS "projectionId"
    `;
    return rows.length;
  },

  async upsertProjection(input: UpsertProjectionInput): Promise<PublishedMemoryProjection> {
    const sql = getWriteSql("upserting published memory projection");
    const projectionHash = hashProjection(input.payload);
    const lifecycle = input.lifecycle || "active";

    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      const projectionVersion = await nextProjectionVersion(tx, input.publishedSnapshotId, input.projectionType);
      let supersededProjectionIds: string[] = [];

      if (lifecycle === "active") {
        const rows = await tx<Array<{ projectionId: string }>>`
          UPDATE published_memory_projections
          SET lifecycle = 'superseded'
          WHERE published_snapshot_id = ${input.publishedSnapshotId}
            AND projection_type = ${input.projectionType}
            AND lifecycle = 'active'
            AND projection_hash <> ${projectionHash}
          RETURNING id::text AS "projectionId"
        `;
        supersededProjectionIds = rows.map((row) => row.projectionId);
      }

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
          ${lifecycle},
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
          superseded_by_projection_id::text AS "supersededByProjectionId",
          created_at::text AS "createdAt"
      `;

      if (supersededProjectionIds.length > 0) {
        await tx`
          UPDATE published_memory_projections
          SET superseded_by_projection_id = ${projection!.projectionId}
          WHERE id = ANY(${supersededProjectionIds}::uuid[])
            AND superseded_by_projection_id IS NULL
        `;
      }

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

  async markSnapshotProjectionsLifecycle(input: {
    publishedSnapshotId: string;
    lifecycle: Extract<PublishedMemoryProjectionLifecycle, "retired" | "merged">;
    sourceEventId: string;
    auditRecordId?: string | null;
    lineage?: {
      retirementId?: string | null;
      mergeId?: string | null;
    };
  }): Promise<PublishedMemoryProjection[]> {
    const sql = getWriteSql(`marking published memory projections ${input.lifecycle}`);
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      const rows = await tx<PublishedMemoryProjection[]>`
        UPDATE published_memory_projections
        SET lifecycle = ${input.lifecycle},
            source_event_type = ${input.lifecycle === "retired" ? "retirement" : "merge"},
            source_event_id = ${input.sourceEventId},
            audit_record_id = COALESCE(${input.auditRecordId || null}, audit_record_id)
        WHERE published_snapshot_id = ${input.publishedSnapshotId}
          AND lifecycle IN ('active', 'superseded')
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
          superseded_by_projection_id::text AS "supersededByProjectionId",
          created_at::text AS "createdAt"
      `;

      for (const row of rows) {
        await tx`
          INSERT INTO published_memory_projection_lineage (
            projection_id,
            published_snapshot_id,
            retirement_id,
            merge_id,
            projection_version,
            projection_hash,
            audit_record_id
          )
          VALUES (
            ${row.projectionId},
            ${row.publishedSnapshotId},
            ${input.lineage?.retirementId || null},
            ${input.lineage?.mergeId || null},
            ${row.projectionVersion},
            ${row.projectionHash},
            ${input.auditRecordId || null}
          )
          ON CONFLICT DO NOTHING
        `;
      }

      return rows;
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
        AND NOT EXISTS (
          SELECT 1
          FROM published_memory_continuity_projections
          WHERE published_memory_continuity_projections.source_published_snapshot_id = published_memory_projections.published_snapshot_id
            AND published_memory_continuity_projections.continuity_type IN ('retired', 'merged')
        )
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  },

  async getActiveProjectionBySlug(type: PublishedReadModelType, slug: string): Promise<PublishedMemoryProjection | null> {
    const sql = getSql();
    if (!sql) {
      return null;
    }
    const [row] = await sql<PublishedMemoryProjection[]>`
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
        superseded_by_projection_id::text AS "supersededByProjectionId",
        created_at::text AS "createdAt"
      FROM published_memory_projections
      WHERE projection_type = ${type}
        AND slug = ${slug}
        AND lifecycle = 'active'
        AND NOT EXISTS (
          SELECT 1
          FROM published_memory_continuity_projections
          WHERE published_memory_continuity_projections.source_published_snapshot_id = published_memory_projections.published_snapshot_id
            AND published_memory_continuity_projections.continuity_type IN ('retired', 'merged')
        )
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return row || null;
  },

  async getActiveRelationshipProjectionByRelationshipId(relationshipId: string): Promise<PublishedMemoryProjection | null> {
    const sql = getSql();
    if (!sql) {
      return null;
    }
    const [row] = await sql<PublishedMemoryProjection[]>`
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
        superseded_by_projection_id::text AS "supersededByProjectionId",
        created_at::text AS "createdAt"
      FROM published_memory_projections
      WHERE projection_type = 'relationship'
        AND lifecycle = 'active'
        AND payload->>'relationship_id' = ${relationshipId}
        AND NOT EXISTS (
          SELECT 1
          FROM published_memory_continuity_projections
          WHERE published_memory_continuity_projections.source_published_snapshot_id = published_memory_projections.published_snapshot_id
            AND published_memory_continuity_projections.continuity_type IN ('retired', 'merged')
        )
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return row || null;
  },

  async listActiveRelationshipProjectionsForAuthorityRef(input: {
    authorityType: string;
    authorityId: string;
    limit: number;
  }): Promise<PublishedMemoryProjection[]> {
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
        superseded_by_projection_id::text AS "supersededByProjectionId",
        created_at::text AS "createdAt"
      FROM published_memory_projections
      WHERE projection_type = 'relationship'
        AND lifecycle = 'active'
        AND (
          (
            payload->'source_authority_ref'->>'authorityType' = ${input.authorityType}
            AND payload->'source_authority_ref'->>'authorityId' = ${input.authorityId}
          )
          OR (
            payload->'target_authority_ref'->>'authorityType' = ${input.authorityType}
            AND payload->'target_authority_ref'->>'authorityId' = ${input.authorityId}
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM published_memory_continuity_projections
          WHERE published_memory_continuity_projections.source_published_snapshot_id = published_memory_projections.published_snapshot_id
            AND published_memory_continuity_projections.continuity_type IN ('retired', 'merged')
        )
      ORDER BY created_at DESC
      LIMIT ${input.limit}
    `;
  },

  async getLatestContinuityProjection(sourcePublishedSnapshotId: string): Promise<PublishedMemoryContinuityProjection | null> {
    const sql = getSql();
    if (!sql) {
      return null;
    }
    const [row] = await sql<PublishedMemoryContinuityProjection[]>`
      SELECT
        id::text AS "continuityProjectionId",
        source_published_snapshot_id::text AS "sourcePublishedSnapshotId",
        target_published_snapshot_id::text AS "targetPublishedSnapshotId",
        continuity_type AS "continuityType",
        continuity_path AS "continuityPath",
        source_event_id::text AS "sourceEventId",
        projection_hash AS "projectionHash",
        audit_record_id::text AS "auditRecordId",
        created_at::text AS "createdAt"
      FROM published_memory_continuity_projections
      WHERE source_published_snapshot_id = ${sourcePublishedSnapshotId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return row || null;
  },

  async getCoverageMetrics(publishedSnapshotCount: number): Promise<ProjectionCoverageMetrics> {
    const sql = getSql();
    if (!sql) {
      return {
        publishedSnapshotCount,
        projectionCountByType: {
          timeline: 0,
          milestone: 0,
          historical_object: 0,
          relationship: 0,
          search: 0,
          sitemap: 0
        },
        searchProjectionCount: 0,
        sitemapProjectionCount: 0,
        continuityProjectionCount: 0,
        activeProjectedSnapshotCount: 0,
        projectionCoveragePercentage: 0,
        relationshipProjectionCount: 0,
        relationshipPublishedSnapshotCount: 0,
        relationshipActiveProjectedSnapshotCount: 0,
        relationshipProjectionCoverage: 0,
        relationshipProjectionFailures: 0,
        relationshipDtoFailures: 0,
        relationshipContinuityProjectionCount: 0
      };
    }

    const [projectionRows, continuityRows, activeRows, relationshipSnapshotRows, relationshipActiveRows, relationshipContinuityRows, latestReportRows] = await Promise.all([
      sql<Array<{ projectionType: PublishedReadModelType; count: number }>>`
        SELECT projection_type AS "projectionType", COUNT(*)::int AS count
        FROM published_memory_projections
        GROUP BY projection_type
      `,
      sql<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM published_memory_continuity_projections
      `,
      sql<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT published_snapshot_id)::int AS count
        FROM published_memory_projections
        WHERE lifecycle = 'active'
      `,
      sql<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM historical_library_published_snapshots
        WHERE lifecycle = 'active'
          AND authority_ref->>'authorityType' = 'relationship'
      `,
      sql<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT published_snapshot_id)::int AS count
        FROM published_memory_projections
        WHERE lifecycle = 'active'
          AND projection_type = 'relationship'
      `,
      sql<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM published_memory_continuity_projections
        INNER JOIN historical_library_published_snapshots
          ON historical_library_published_snapshots.id = published_memory_continuity_projections.source_published_snapshot_id
        WHERE historical_library_published_snapshots.authority_ref->>'authorityType' = 'relationship'
      `,
      sql<Array<{ dtoFailures: number; rebuildFailures: number }>>`
        SELECT
          COALESCE((
            SELECT COUNT(*)::int
            FROM jsonb_array_elements(dto_validation_failures) failure
            WHERE failure->>'projectionType' = 'relationship'
          ), 0)::int AS "dtoFailures",
          COALESCE((
            SELECT COUNT(*)::int
            FROM jsonb_array_elements(rebuild_failures) failure
            WHERE failure->>'projectionType' = 'relationship'
          ), 0)::int AS "rebuildFailures"
        FROM published_memory_projection_rebuild_reports
        ORDER BY created_at DESC
        LIMIT 1
      `
    ]);

    const projectionCountByType: Record<PublishedReadModelType, number> = {
      timeline: 0,
      milestone: 0,
      historical_object: 0,
      relationship: 0,
      search: 0,
      sitemap: 0
    };
    for (const row of projectionRows) {
      projectionCountByType[row.projectionType] = row.count;
    }

    const activeProjectedSnapshotCount = activeRows[0]?.count || 0;
    const relationshipPublishedSnapshotCount = relationshipSnapshotRows[0]?.count || 0;
    const relationshipActiveProjectedSnapshotCount = relationshipActiveRows[0]?.count || 0;
    return {
      publishedSnapshotCount,
      projectionCountByType,
      searchProjectionCount: projectionCountByType.search,
      sitemapProjectionCount: projectionCountByType.sitemap,
      continuityProjectionCount: continuityRows[0]?.count || 0,
      activeProjectedSnapshotCount,
      projectionCoveragePercentage: publishedSnapshotCount === 0 ? 100 : Number(((activeProjectedSnapshotCount / publishedSnapshotCount) * 100).toFixed(2)),
      relationshipProjectionCount: projectionCountByType.relationship,
      relationshipPublishedSnapshotCount,
      relationshipActiveProjectedSnapshotCount,
      relationshipProjectionCoverage:
        relationshipPublishedSnapshotCount === 0
          ? 100
          : Number(((relationshipActiveProjectedSnapshotCount / relationshipPublishedSnapshotCount) * 100).toFixed(2)),
      relationshipProjectionFailures: latestReportRows[0]?.rebuildFailures || 0,
      relationshipDtoFailures: latestReportRows[0]?.dtoFailures || 0,
      relationshipContinuityProjectionCount: relationshipContinuityRows[0]?.count || 0
    };
  },

  async insertRebuildReport(input: ProjectionRebuildReportInput): Promise<ProjectionRebuildReport> {
    const sql = getWriteSql("inserting published memory projection rebuild report");
    const [row] = await sql<Array<ProjectionRebuildReport & { reportId: string }>>`
      INSERT INTO published_memory_projection_rebuild_reports (
        status,
        started_at,
        completed_at,
        duration_ms,
        batch_size,
        total_processed,
        generated,
        updated,
        unchanged,
        failed,
        skipped,
        continuity_projection_count,
        coverage_summary,
        dto_validation_failures,
        rebuild_failures
      )
      VALUES (
        ${input.status},
        ${input.startedAt},
        ${input.completedAt},
        ${input.durationMs},
        ${input.batchSize},
        ${input.totalProcessed},
        ${input.generated},
        ${input.updated},
        ${input.unchanged},
        ${input.failed},
        ${input.skipped},
        ${input.continuityProjectionCount},
        ${sql.json(input.coverageSummary as any)},
        ${sql.json(input.dtoValidationFailures as any)},
        ${sql.json(input.rebuildFailures as any)}
      )
      RETURNING
        id::text AS "reportId",
        status,
        started_at::text AS "startedAt",
        completed_at::text AS "completedAt",
        duration_ms::int AS "durationMs",
        batch_size::int AS "batchSize",
        total_processed::int AS "totalProcessed",
        generated::int AS "generated",
        updated::int AS "updated",
        unchanged::int AS "unchanged",
        failed::int AS "failed",
        skipped::int AS "skipped",
        continuity_projection_count::int AS "continuityProjectionCount",
        coverage_summary AS "coverageSummary",
        dto_validation_failures AS "dtoValidationFailures",
        rebuild_failures AS "rebuildFailures",
        created_at::text AS "createdAt"
    `;
    return row!;
  },

  async reconcileLifecycleState(input: {
    retiredSnapshotIds: string[];
    mergedSnapshotIds: string[];
  }): Promise<{ supersededCount: number; retiredCount: number; mergedCount: number }> {
    const sql = getWriteSql("reconciling published memory projection lifecycle");
    return sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      const superseded = await tx<Array<{ projectionId: string }>>`
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY published_snapshot_id, projection_type
              ORDER BY created_at DESC, projection_version DESC, id DESC
            ) AS active_rank
          FROM published_memory_projections
          WHERE lifecycle = 'active'
        )
        UPDATE published_memory_projections
        SET lifecycle = 'superseded'
        FROM ranked
        WHERE published_memory_projections.id = ranked.id
          AND ranked.active_rank > 1
        RETURNING published_memory_projections.id::text AS "projectionId"
      `;

      const retired = input.retiredSnapshotIds.length
        ? await tx<Array<{ projectionId: string }>>`
            UPDATE published_memory_projections
            SET lifecycle = 'retired'
            WHERE published_snapshot_id = ANY(${input.retiredSnapshotIds}::uuid[])
              AND lifecycle IN ('active', 'superseded')
            RETURNING id::text AS "projectionId"
          `
        : [];

      const merged = input.mergedSnapshotIds.length
        ? await tx<Array<{ projectionId: string }>>`
            UPDATE published_memory_projections
            SET lifecycle = 'merged'
            WHERE published_snapshot_id = ANY(${input.mergedSnapshotIds}::uuid[])
              AND lifecycle IN ('active', 'superseded')
            RETURNING id::text AS "projectionId"
          `
        : [];

      return {
        supersededCount: superseded.length,
        retiredCount: retired.length,
        mergedCount: merged.length
      };
    });
  }
};
