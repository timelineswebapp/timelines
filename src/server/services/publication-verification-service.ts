import { getWriteSql } from "@/src/server/db/client";

export const publicationVerificationService = {
  async verify(packageId: string) {
    const sql = getWriteSql("verifying institutional publication");
    const [row] = await sql<{
      snapshotCount: number; projectionCount: number; timelineCount: number; searchCount: number; sitemapCount: number;
    }[]>`
      SELECT
        COUNT(DISTINCT s.id)::int AS "snapshotCount",
        COUNT(DISTINCT p.id)::int AS "projectionCount",
        COUNT(DISTINCT p.id) FILTER (WHERE p.projection_type='timeline')::int AS "timelineCount",
        COUNT(DISTINCT search.id)::int AS "searchCount",
        COUNT(DISTINCT sitemap.id)::int AS "sitemapCount"
      FROM historical_library_admissions a
      LEFT JOIN historical_library_published_snapshots s ON s.admission_id=a.id
      LEFT JOIN published_memory_projections p ON p.published_snapshot_id=s.id AND p.lifecycle='active'
      LEFT JOIN published_memory_projections search ON search.published_snapshot_id=s.id AND search.projection_type='search' AND search.lifecycle='active'
      LEFT JOIN published_memory_projections sitemap ON sitemap.published_snapshot_id=s.id AND sitemap.projection_type='sitemap' AND sitemap.lifecycle='active'
      WHERE a.publication_package_id=${packageId}`;
    const counts = row || { snapshotCount: 0, projectionCount: 0, timelineCount: 0, searchCount: 0, sitemapCount: 0 };
    const checks = {
      publishedMemorySnapshot: counts.snapshotCount > 0,
      projection: counts.projectionCount >= counts.snapshotCount,
      timelineGeneration: counts.timelineCount > 0,
      searchProjection: counts.searchCount > 0,
      sitemapGeneration: counts.sitemapCount > 0
    };
    return { checks, failures: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name), counts };
  }
};
