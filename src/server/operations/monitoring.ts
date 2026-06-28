export type OperationalMetric = {
  key: string;
  severity: "info" | "warning" | "critical";
  targetMs?: number;
  description: string;
};

export type AlertDefinition = {
  key: string;
  metric: string;
  threshold: string;
  severity: "warning" | "critical";
  owner: "platform" | "database" | "source_authority" | "publication_pipeline" | "projection" | "recovery" | "cost";
};

export const operationalMetrics: OperationalMetric[] = [
  { key: "factory.queue.depth", severity: "warning", description: "Durable topic queue depth." },
  { key: "factory.queue.oldest_age_seconds", severity: "warning", description: "Age of the oldest dispatchable topic." },
  { key: "workflow.active", severity: "info", description: "Active durable workflows." },
  { key: "workflow.completed", severity: "info", description: "Completed durable workflows." },
  { key: "factory.worker.utilization", severity: "warning", description: "Active execution to registered worker ratio." },
  { key: "publication.throughput_hour", severity: "info", description: "Completed publications in the last hour." },
  { key: "publication.latency_ms", severity: "warning", description: "Mean topic-to-publication latency." },
  { key: "governance.latency_ms", severity: "warning", description: "Mean Governance wait latency." },
  { key: "workflow.retry_count", severity: "warning", description: "Cumulative retry count." },
  { key: "workflow.replay_count", severity: "info", description: "Persisted replay count." },
  { key: "factory.dead_letter.depth", severity: "critical", description: "Dead-letter topic count." },
  { key: "projection.duration_ms", severity: "warning", description: "Mean projection rebuild duration." },
  { key: "projection.failures", severity: "critical", description: "Projection failures in the observation window." },
  { key: "platform.health.ok", severity: "critical", targetMs: 500, description: "API health endpoint returns 200 with database connectivity." },
  { key: "database.probe.latency_ms", severity: "warning", targetMs: 250, description: "Database SELECT 1 latency remains inside operational target." },
  { key: "source_authority.provider.cooldown_active", severity: "warning", description: "Source provider has active persisted cooldown." },
  { key: "source_authority.provider.consecutive_failures", severity: "critical", description: "Source provider failure count crosses failover threshold." },
  { key: "publication.pipeline.blocked_packages", severity: "critical", description: "Governance publication packages remain blocked or failed." },
  { key: "projection.rebuild.failed", severity: "critical", description: "Published Memory projection rebuild reports failures." },
  { key: "projection.coverage.empty", severity: "critical", description: "Platform has no active timeline projections." },
  { key: "errors.structured.rate", severity: "warning", description: "Structured operational errors exceed threshold." },
  { key: "database.pitr.ready", severity: "critical", description: "Database PITR configuration satisfies recovery window and drill requirements." },
  { key: "backup.baseline.valid", severity: "critical", description: "Latest backup baseline manifest passes checksum validation." },
  { key: "restore.manifest.valid", severity: "critical", description: "Restore target is validated against a verified backup manifest." },
  { key: "recovery.certification.ready", severity: "critical", description: "Recovery validation scripts and required queries are ready." },
  { key: "storage.retention.configured", severity: "warning", description: "Retention policies cover operational storage classes." },
  { key: "storage.budget.projected_monthly_usd", severity: "warning", description: "Projected monthly storage cost stays within budget thresholds." }
];

export const alertDefinitions: AlertDefinition[] = [
  { key: "factory-stale-queue", metric: "factory.queue.oldest_age_seconds", threshold: "> 1800 seconds", severity: "warning", owner: "publication_pipeline" },
  { key: "factory-dead-letter", metric: "factory.dead_letter.depth", threshold: "> 0", severity: "critical", owner: "publication_pipeline" },
  { key: "workflow-retry-volume", metric: "workflow.retry_count", threshold: "> 20", severity: "warning", owner: "publication_pipeline" },
  { key: "projection-runtime-failure", metric: "projection.failures", threshold: "> 0 in 24 hours", severity: "critical", owner: "projection" },
  { key: "platform-health-unavailable", metric: "platform.health.ok", threshold: "ok != true for 2 consecutive checks", severity: "critical", owner: "platform" },
  { key: "database-latency-high", metric: "database.probe.latency_ms", threshold: "> 250ms for 5 minutes", severity: "warning", owner: "database" },
  { key: "source-provider-cooldown", metric: "source_authority.provider.cooldown_active", threshold: "cooldown_active == true for any provider", severity: "warning", owner: "source_authority" },
  { key: "source-provider-failure-streak", metric: "source_authority.provider.consecutive_failures", threshold: ">= 3 for any provider", severity: "critical", owner: "source_authority" },
  { key: "publication-pipeline-blocked", metric: "publication.pipeline.blocked_packages", threshold: "> 0 for 30 minutes", severity: "critical", owner: "publication_pipeline" },
  { key: "projection-rebuild-failed", metric: "projection.rebuild.failed", threshold: "> 0 in latest rebuild report", severity: "critical", owner: "projection" },
  { key: "projection-coverage-empty", metric: "projection.coverage.empty", threshold: "active timeline projections == 0", severity: "critical", owner: "projection" },
  { key: "database-pitr-not-ready", metric: "database.pitr.ready", threshold: "ready != true", severity: "critical", owner: "recovery" },
  { key: "backup-baseline-invalid", metric: "backup.baseline.valid", threshold: "valid != true", severity: "critical", owner: "recovery" },
  { key: "restore-manifest-invalid", metric: "restore.manifest.valid", threshold: "valid != true", severity: "critical", owner: "recovery" },
  { key: "storage-budget-warning", metric: "storage.budget.projected_monthly_usd", threshold: "> configured soft limit", severity: "warning", owner: "cost" }
];

export function validateMonitoringConfiguration(): { ok: boolean; missingAlertMetrics: string[] } {
  const metricKeys = new Set(operationalMetrics.map((metric) => metric.key));
  const missingAlertMetrics = alertDefinitions
    .filter((alert) => !metricKeys.has(alert.metric))
    .map((alert) => alert.key);
  return { ok: missingAlertMetrics.length === 0, missingAlertMetrics };
}
