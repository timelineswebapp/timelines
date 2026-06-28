import { getWriteSql } from "@/src/server/db/client";

export const performanceAnalyticsService = {
  async getReport() {
    const sql = getWriteSql("reading performance analytics");
    const [summary, providers, projections] = await Promise.all([
      sql<Record<string, number>[]>`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '1 hour')::int AS "topicsPerHour",
          COUNT(*) FILTER (WHERE completed_at >= NOW()-INTERVAL '1 day')::int AS "publicationsPerDay",
          COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at-created_at))*1000) FILTER (WHERE completed_at IS NOT NULL),0)::float AS "averageWorkflowDurationMs",
          COUNT(*) FILTER (WHERE completed_at >= NOW()-INTERVAL '1 hour')::float AS "queueThroughputPerHour",
          COALESCE((SELECT COUNT(*)::float FROM factory_runtime_executions WHERE status='started') /
            NULLIF((SELECT COUNT(*)::float FROM factory_runtime_workers WHERE status='registered'),0),0)::float AS "workerUtilization"
        FROM factory_topic_work_items`,
      sql<Array<{ providerKey: string; executions: number; averageLatencyMs: number; averageCostUsd: number; failureRate: number }>>`
        SELECT provider_key AS "providerKey",COUNT(*)::int AS executions,AVG(latency_ms)::float AS "averageLatencyMs",
          AVG(estimated_cost_usd)::float AS "averageCostUsd",
          COALESCE(COUNT(*) FILTER (WHERE status<>'completed')::float/NULLIF(COUNT(*),0),0)::float AS "failureRate"
        FROM provider_execution_metrics WHERE created_at >= NOW()-INTERVAL '30 days' GROUP BY provider_key`,
      sql<Array<{ averageDurationMs: number; throughputPerMinute: number; failureRate: number }>>`
        SELECT COALESCE(AVG(duration_ms),0)::float AS "averageDurationMs",
          COALESCE(AVG(total_processed/NULLIF(duration_ms/60000.0,0)),0)::float AS "throughputPerMinute",
          COALESCE(SUM(failed)::float/NULLIF(SUM(total_processed),0),0)::float AS "failureRate"
        FROM published_memory_projection_rebuild_reports WHERE created_at >= NOW()-INTERVAL '30 days'`
    ]);
    return { summary: summary[0] || {}, providers, projections: projections[0] || {} };
  }
};
