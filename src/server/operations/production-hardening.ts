import { readFileSync } from "node:fs";
import { join } from "node:path";
import { alertDefinitions, operationalMetrics } from "@/src/server/operations/monitoring";

type Severity = "info" | "warning" | "critical";

type DashboardDefinition = {
  key: string;
  title: string;
  metrics: string[];
  refreshSeconds: number;
};

type AlertDeliveryRoute = {
  severity: Severity;
  channel: string;
  delivery: "webhook";
  webhookEnv: string;
};

type PitrReadinessConfig = {
  required: boolean;
  verification: {
    requiresProviderPitrEnabled: boolean;
    requiresRecoveryWindowHours: number;
    requiresRestoreDrillWithinDays: number;
    requiresBackupManifestValidation: boolean;
    requiresIsolatedRestoreTarget: boolean;
  };
};

type RetentionPolicy = {
  key: string;
  retainDays: number;
  action: string;
  authority: string;
};

type RetentionConfig = {
  storageBudget: {
    monthlyUsdSoftLimit: number;
    monthlyUsdHardLimit: number;
    reviewCadenceDays: number;
  };
  retentionPolicies: RetentionPolicy[];
};

type DeploymentWorkflow = {
  promotion: {
    source: string;
    target: string;
    requiredChecks: string[];
  };
  rollback: {
    requiresRollbackPlan: boolean;
    requiresMigrationRollbackWhenSchemaChanges: boolean;
    requiresBackupManifest: boolean;
    requiresIncidentCommanderApproval: boolean;
  };
};

type IncidentSeverity = {
  level: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  responseMinutes: number;
  escalation: string[];
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as T;
}

export function dashboardDefinitions(): DashboardDefinition[] {
  return readJson<{ dashboards: DashboardDefinition[] }>("ops/observability/dashboards.json").dashboards;
}

export function alertDeliveryRoutes(): AlertDeliveryRoute[] {
  return readJson<{ routes: AlertDeliveryRoute[] }>("ops/alerts/delivery.json").routes;
}

export function pitrReadinessConfig(): PitrReadinessConfig {
  return readJson<PitrReadinessConfig>("ops/recovery/pitr.json");
}

export function retentionConfig(): RetentionConfig {
  return readJson<RetentionConfig>("ops/cost/retention.json");
}

export function deploymentWorkflow(): DeploymentWorkflow {
  return readJson<DeploymentWorkflow>("ops/deployment/workflow.json");
}

export function incidentSeverities(): IncidentSeverity[] {
  return readJson<{ severities: IncidentSeverity[] }>("ops/incidents/severity.json").severities;
}

export function validateDashboardDefinitions(): { ok: boolean; missingMetrics: string[]; missingDashboards: string[] } {
  const metricKeys = new Set(operationalMetrics.map((metric) => metric.key));
  const dashboards = dashboardDefinitions();
  const requiredDashboards = new Set([
    "platform-health",
    "publication-pipeline",
    "provider-health",
    "database-health",
    "projection-health"
  ]);
  const missingMetrics = dashboards.flatMap((dashboard) => dashboard.metrics.filter((metric) => !metricKeys.has(metric)));
  const missingDashboards = Array.from(requiredDashboards).filter((key) => !dashboards.some((dashboard) => dashboard.key === key));
  return { ok: missingMetrics.length === 0 && missingDashboards.length === 0, missingMetrics, missingDashboards };
}

export function validateAlertDeliveryConfiguration(): { ok: boolean; missingSeverities: Severity[]; unsupportedRoutes: string[] } {
  const routes = alertDeliveryRoutes();
  const severitySet = new Set(routes.map((route) => route.severity));
  const alertSeveritySet = new Set(alertDefinitions.map((alert) => alert.severity));
  const missingSeverities = Array.from(alertSeveritySet).filter((severity) => !severitySet.has(severity));
  const unsupportedRoutes = routes.filter((route) => route.delivery !== "webhook" || !route.webhookEnv).map((route) => route.channel);
  return { ok: missingSeverities.length === 0 && unsupportedRoutes.length === 0, missingSeverities, unsupportedRoutes };
}

export function validatePitrReadinessConfiguration(): { ok: boolean; defects: string[] } {
  const config = pitrReadinessConfig();
  const defects: string[] = [];
  if (!config.required) defects.push("pitr_not_required");
  if (!config.verification.requiresProviderPitrEnabled) defects.push("provider_pitr_check_missing");
  if (config.verification.requiresRecoveryWindowHours < 24) defects.push("recovery_window_too_short");
  if (config.verification.requiresRestoreDrillWithinDays > 30) defects.push("restore_drill_window_too_long");
  if (!config.verification.requiresBackupManifestValidation) defects.push("backup_manifest_validation_missing");
  if (!config.verification.requiresIsolatedRestoreTarget) defects.push("isolated_restore_target_missing");
  return { ok: defects.length === 0, defects };
}

export function validateRetentionConfiguration(): { ok: boolean; missingPolicies: string[]; budgetValid: boolean } {
  const config = retentionConfig();
  const requiredPolicies = [
    "source_snapshots",
    "corpus_documents",
    "evidence_records",
    "runtime_executions",
    "audit_events",
    "backups",
    "projections"
  ];
  const policyKeys = new Set(config.retentionPolicies.map((policy) => policy.key));
  const missingPolicies = requiredPolicies.filter((policy) => !policyKeys.has(policy));
  const budgetValid =
    config.storageBudget.monthlyUsdSoftLimit > 0 &&
    config.storageBudget.monthlyUsdHardLimit >= config.storageBudget.monthlyUsdSoftLimit &&
    config.storageBudget.reviewCadenceDays > 0;
  return { ok: missingPolicies.length === 0 && budgetValid, missingPolicies, budgetValid };
}

export function validateDeploymentWorkflow(): { ok: boolean; missingChecks: string[]; rollbackValid: boolean } {
  const workflow = deploymentWorkflow();
  const requiredChecks = [
    "npm run typecheck",
    "npm test",
    "npm run lint",
    "npm run build",
    "npm audit --audit-level=high --omit=dev",
    "npm run ops:migrations:dry-run",
    "npm run ops:monitoring:verify",
    "npm run ops:production:verify"
  ];
  const missingChecks = requiredChecks.filter((check) => !workflow.promotion.requiredChecks.includes(check));
  const rollbackValid =
    workflow.promotion.source === "staging" &&
    workflow.promotion.target === "production" &&
    workflow.rollback.requiresRollbackPlan &&
    workflow.rollback.requiresMigrationRollbackWhenSchemaChanges &&
    workflow.rollback.requiresBackupManifest &&
    workflow.rollback.requiresIncidentCommanderApproval;
  return { ok: missingChecks.length === 0 && rollbackValid, missingChecks, rollbackValid };
}

export function validateIncidentSeverityModel(): { ok: boolean; missingSeverities: string[] } {
  const required: IncidentSeverity["level"][] = ["SEV1", "SEV2", "SEV3", "SEV4"];
  const severities = incidentSeverities();
  const keys = new Set(severities.map((severity) => severity.level));
  const missingSeverities = required.filter((severity) => !keys.has(severity));
  const invalid = severities.some((severity) => severity.responseMinutes <= 0 || severity.escalation.length === 0);
  return { ok: missingSeverities.length === 0 && !invalid, missingSeverities };
}

export function validateProductionHardening(): { ok: boolean; checks: Record<string, unknown> } {
  const checks = {
    dashboards: validateDashboardDefinitions(),
    alerts: validateAlertDeliveryConfiguration(),
    pitr: validatePitrReadinessConfiguration(),
    retention: validateRetentionConfiguration(),
    deployment: validateDeploymentWorkflow(),
    incidents: validateIncidentSeverityModel()
  };
  return {
    ok: Object.values(checks).every((check) => typeof check === "object" && check !== null && "ok" in check && check.ok === true),
    checks
  };
}

export async function deliverOperationalAlert(input: {
  severity: Severity;
  key: string;
  message: string;
  details?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
}): Promise<{ delivered: boolean; channel: string; status: number }> {
  const route = alertDeliveryRoutes().find((candidate) => candidate.severity === input.severity);
  if (!route) throw new Error(`No alert route configured for severity ${input.severity}.`);
  const env = input.env ?? process.env;
  const webhookUrl = env[route.webhookEnv];
  if (!webhookUrl) throw new Error(`Alert webhook is not configured: ${route.webhookEnv}.`);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      severity: input.severity,
      key: input.key,
      message: input.message,
      details: input.details ?? {}
    })
  });
  return { delivered: response.ok, channel: route.channel, status: response.status };
}
