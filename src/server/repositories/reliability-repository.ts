import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";

export type MetricSample = { key: string; value: number; unit: string; dimensions?: Record<string, unknown> };
export type InstitutionHealth = { institution: string; status: "healthy" | "warning" | "critical"; reasons: string[]; metrics: Record<string, number>; assessedAt?: string };
export type OperationalAlert = {
  id: string; alertKey: string; topicId: string | null; institution: string | null;
  severity: "warning" | "critical"; status: "open" | "acknowledged" | "resolved";
  message: string; details: Record<string, unknown>; firstObservedAt: string; lastObservedAt: string;
};

export const reliabilityRepository = {
  async collectCurrentMetrics(): Promise<MetricSample[]> {
    const sql = getWriteSql("collecting operational metrics");
    const [row] = await sql<Record<string, number>[]>`
      SELECT
        COUNT(*) FILTER (WHERE t.status IN ('queued','failed'))::int AS queue_depth,
        COALESCE(EXTRACT(EPOCH FROM (NOW()-(MIN(t.created_at) FILTER (WHERE t.status IN ('queued','failed'))))),0)::float AS queue_age_seconds,
        COUNT(*) FILTER (WHERE t.status='running')::int AS active_workflows,
        COUNT(*) FILTER (WHERE t.status='completed')::int AS completed_workflows,
        COUNT(*) FILTER (WHERE t.status='dead_letter')::int AS dead_letter_depth,
        COALESCE(SUM(t.retry_count),0)::int AS retry_count,
        COUNT(*) FILTER (WHERE t.completed_at >= NOW()-INTERVAL '1 hour')::int AS publication_throughput,
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.completed_at-t.created_at))*1000) FILTER (WHERE t.completed_at IS NOT NULL),0)::float AS publication_latency_ms,
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.updated_at-t.created_at))*1000) FILTER (WHERE t.current_stage='governance'),0)::float AS governance_latency_ms,
        (SELECT COUNT(*)::int FROM factory_topic_execution_history WHERE action='replay') AS replay_count,
        (SELECT COALESCE(AVG(duration_ms),0)::float FROM published_memory_projection_rebuild_reports WHERE created_at >= NOW()-INTERVAL '24 hours') AS projection_duration_ms,
        (SELECT COALESCE(SUM(failed),0)::int FROM published_memory_projection_rebuild_reports WHERE created_at >= NOW()-INTERVAL '24 hours') AS projection_failures,
        (SELECT COUNT(*)::int FROM factory_runtime_workers WHERE status='registered') AS registered_workers,
        (SELECT COUNT(*)::int FROM factory_runtime_executions WHERE status='started') AS active_worker_executions
      FROM factory_topic_work_items t`;
    const values = row || {};
    const workerUtilization = values.registered_workers ? (values.active_worker_executions || 0) / values.registered_workers : 0;
    return [
      ["factory.queue.depth", values.queue_depth, "count"],
      ["factory.queue.oldest_age_seconds", values.queue_age_seconds, "seconds"],
      ["workflow.active", values.active_workflows, "count"],
      ["workflow.completed", values.completed_workflows, "count"],
      ["factory.worker.utilization", workerUtilization, "ratio"],
      ["publication.throughput_hour", values.publication_throughput, "count"],
      ["publication.latency_ms", values.publication_latency_ms, "milliseconds"],
      ["governance.latency_ms", values.governance_latency_ms, "milliseconds"],
      ["workflow.retry_count", values.retry_count, "count"],
      ["workflow.replay_count", values.replay_count, "count"],
      ["factory.dead_letter.depth", values.dead_letter_depth, "count"],
      ["projection.duration_ms", values.projection_duration_ms, "milliseconds"],
      ["projection.failures", values.projection_failures, "count"]
    ].map(([key, value, unit]) => ({ key: String(key), value: Number(value || 0), unit: String(unit) }));
  },

  async persistMetrics(samples: MetricSample[]) {
    const sql = getWriteSql("persisting operational metrics");
    await sql.begin(async (tx) => {
      for (const sample of samples) await tx.unsafe(
        "INSERT INTO operational_metric_measurements (metric_key,value,unit,dimensions) VALUES ($1,$2,$3,$4::jsonb)",
        [sample.key, sample.value, sample.unit, JSON.stringify(sample.dimensions || {})]);
    });
  },

  async persistHealth(assessments: InstitutionHealth[]) {
    const sql = getWriteSql("persisting operational health");
    await sql.begin(async (tx) => {
      for (const item of assessments) await tx.unsafe(
        "INSERT INTO operational_health_assessments (institution,status,reasons,metrics) VALUES ($1,$2,$3::jsonb,$4::jsonb)",
        [item.institution, item.status, JSON.stringify(item.reasons), JSON.stringify(item.metrics)]);
    });
  },

  async upsertAlert(input: { alertKey: string; topicId?: string | null; institution?: string | null; severity: OperationalAlert["severity"]; message: string; details?: Record<string, unknown>; deduplicationKey: string }) {
    const sql = getWriteSql("persisting operational alert");
    return sql.begin(async (tx) => {
      const rows = await tx.unsafe<OperationalAlert[]>(
        `INSERT INTO operational_alerts (alert_key,topic_id,institution,severity,message,details,deduplication_key)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
         ON CONFLICT (deduplication_key) WHERE status <> 'resolved'
         DO UPDATE SET last_observed_at=NOW(), severity=EXCLUDED.severity, message=EXCLUDED.message, details=EXCLUDED.details
         RETURNING id::text AS id,alert_key AS "alertKey",topic_id::text AS "topicId",institution,severity,status,message,details,
           first_observed_at::text AS "firstObservedAt",last_observed_at::text AS "lastObservedAt"`,
        [input.alertKey, input.topicId || null, input.institution || null, input.severity, input.message, JSON.stringify(input.details || {}), input.deduplicationKey]);
      const alert = rows[0];
      if (!alert) throw new ApiError(500, "ALERT_PERSISTENCE_FAILED", "Operational alert was not persisted.");
      await tx.unsafe("INSERT INTO operational_alert_history (alert_id,action,actor,details) VALUES ($1,$2,'reliability-engine',$3::jsonb)",
        [alert.id, alert.firstObservedAt === alert.lastObservedAt ? "opened" : "observed", JSON.stringify(input.details || {})]);
      return alert;
    });
  },

  async transitionAlert(id: string, action: "acknowledge" | "resolve", actor: string) {
    const sql = getWriteSql("transitioning operational alert");
    const status = action === "acknowledge" ? "acknowledged" : "resolved";
    const rows = await sql.unsafe<OperationalAlert[]>(
      `UPDATE operational_alerts SET status=$1,
       acknowledged_at=CASE WHEN $1='acknowledged' THEN NOW() ELSE acknowledged_at END,
       acknowledged_by=CASE WHEN $1='acknowledged' THEN $2 ELSE acknowledged_by END,
       resolved_at=CASE WHEN $1='resolved' THEN NOW() ELSE resolved_at END,
       resolved_by=CASE WHEN $1='resolved' THEN $2 ELSE resolved_by END
       WHERE id=$3 AND status <> 'resolved'
       RETURNING id::text AS id,alert_key AS "alertKey",topic_id::text AS "topicId",institution,severity,status,message,details,
       first_observed_at::text AS "firstObservedAt",last_observed_at::text AS "lastObservedAt"`,
      [status, actor, id]);
    const alert = rows[0];
    if (!alert) throw new ApiError(404, "ALERT_NOT_FOUND", "Open operational alert was not found.");
    await sql`INSERT INTO operational_alert_history (alert_id,action,actor,details) VALUES (${id},${action === "acknowledge" ? "acknowledged" : "resolved"},${actor},'{}')`;
    return alert;
  },

  async dashboard() {
    const sql = getWriteSql("reading reliability dashboard");
    const [metrics, health, alerts, trends] = await Promise.all([
      sql<{ metricKey: string; value: number; unit: string; measuredAt: string }[]>`
        SELECT DISTINCT ON (metric_key) metric_key AS "metricKey",value,unit,measured_at::text AS "measuredAt"
        FROM operational_metric_measurements ORDER BY metric_key,measured_at DESC`,
      sql<InstitutionHealth[]>`SELECT DISTINCT ON (institution) institution,status,reasons,metrics,assessed_at::text AS "assessedAt"
        FROM operational_health_assessments ORDER BY institution,assessed_at DESC`,
      sql<OperationalAlert[]>`SELECT id::text AS id,alert_key AS "alertKey",topic_id::text AS "topicId",institution,severity,status,message,details,
        first_observed_at::text AS "firstObservedAt",last_observed_at::text AS "lastObservedAt"
        FROM operational_alerts WHERE status <> 'resolved' ORDER BY severity DESC,last_observed_at DESC LIMIT 200`,
      sql<{ metricKey: string; bucket: string; average: number }[]>`SELECT metric_key AS "metricKey",date_trunc('hour',measured_at)::text AS bucket,AVG(value)::float AS average
        FROM operational_metric_measurements WHERE measured_at >= NOW()-INTERVAL '7 days'
        GROUP BY metric_key,date_trunc('hour',measured_at) ORDER BY bucket DESC LIMIT 2000`
    ]);
    return { metrics, health, alerts, trends };
  }
};
