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
  owner: "platform" | "database" | "source_authority" | "publication_pipeline" | "projection";
};

export const operationalMetrics: OperationalMetric[] = [
  { key: "platform.health.ok", severity: "critical", targetMs: 500, description: "API health endpoint returns 200 with database connectivity." },
  { key: "database.probe.latency_ms", severity: "warning", targetMs: 250, description: "Database SELECT 1 latency remains inside operational target." },
  { key: "source_authority.provider.cooldown_active", severity: "warning", description: "Source provider has active persisted cooldown." },
  { key: "source_authority.provider.consecutive_failures", severity: "critical", description: "Source provider failure count crosses failover threshold." },
  { key: "publication.pipeline.blocked_packages", severity: "critical", description: "Governance publication packages remain blocked or failed." },
  { key: "projection.rebuild.failed", severity: "critical", description: "Published Memory projection rebuild reports failures." },
  { key: "projection.coverage.empty", severity: "critical", description: "Platform has no active timeline projections." },
  { key: "errors.structured.rate", severity: "warning", description: "Structured operational errors exceed threshold." }
];

export const alertDefinitions: AlertDefinition[] = [
  { key: "platform-health-unavailable", metric: "platform.health.ok", threshold: "ok != true for 2 consecutive checks", severity: "critical", owner: "platform" },
  { key: "database-latency-high", metric: "database.probe.latency_ms", threshold: "> 250ms for 5 minutes", severity: "warning", owner: "database" },
  { key: "source-provider-cooldown", metric: "source_authority.provider.cooldown_active", threshold: "cooldown_active == true for any provider", severity: "warning", owner: "source_authority" },
  { key: "source-provider-failure-streak", metric: "source_authority.provider.consecutive_failures", threshold: ">= 3 for any provider", severity: "critical", owner: "source_authority" },
  { key: "publication-pipeline-blocked", metric: "publication.pipeline.blocked_packages", threshold: "> 0 for 30 minutes", severity: "critical", owner: "publication_pipeline" },
  { key: "projection-rebuild-failed", metric: "projection.rebuild.failed", threshold: "> 0 in latest rebuild report", severity: "critical", owner: "projection" },
  { key: "projection-coverage-empty", metric: "projection.coverage.empty", threshold: "active timeline projections == 0", severity: "critical", owner: "projection" }
];

export function validateMonitoringConfiguration(): { ok: boolean; missingAlertMetrics: string[] } {
  const metricKeys = new Set(operationalMetrics.map((metric) => metric.key));
  const missingAlertMetrics = alertDefinitions
    .filter((alert) => !metricKeys.has(alert.metric))
    .map((alert) => alert.key);
  return { ok: missingAlertMetrics.length === 0, missingAlertMetrics };
}
