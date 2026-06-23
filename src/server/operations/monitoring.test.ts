import test from "node:test";
import assert from "node:assert/strict";
import { alertDefinitions, operationalMetrics, validateMonitoringConfiguration } from "@/src/server/operations/monitoring";
import {
  deliverOperationalAlert,
  validateAlertDeliveryConfiguration,
  validateDashboardDefinitions,
  validateDeploymentWorkflow,
  validateIncidentSeverityModel,
  validatePitrReadinessConfiguration,
  validateProductionHardening,
  validateRetentionConfiguration
} from "@/src/server/operations/production-hardening";

test("monitoring configuration maps every alert to a declared metric", () => {
  const result = validateMonitoringConfiguration();
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingAlertMetrics, []);
});

test("monitoring covers platform, database, Source Authority, publication, projection, and error metrics", () => {
  const metricKeys = new Set(operationalMetrics.map((metric) => metric.key));
  assert.equal(metricKeys.has("platform.health.ok"), true);
  assert.equal(metricKeys.has("database.probe.latency_ms"), true);
  assert.equal(metricKeys.has("source_authority.provider.consecutive_failures"), true);
  assert.equal(metricKeys.has("publication.pipeline.blocked_packages"), true);
  assert.equal(metricKeys.has("projection.rebuild.failed"), true);
  assert.equal(metricKeys.has("errors.structured.rate"), true);
  assert.equal(metricKeys.has("database.pitr.ready"), true);
  assert.equal(metricKeys.has("backup.baseline.valid"), true);
  assert.equal(metricKeys.has("storage.retention.configured"), true);
  assert.ok(alertDefinitions.length >= 7);
});

test("production observability dashboards cover required operational surfaces", () => {
  const result = validateDashboardDefinitions();
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingDashboards, []);
  assert.deepEqual(result.missingMetrics, []);
});

test("alert delivery configuration supports webhook routes for alert severities", () => {
  const result = validateAlertDeliveryConfiguration();
  assert.equal(result.ok, true);
  assert.deepEqual(result.missingSeverities, []);
  assert.deepEqual(result.unsupportedRoutes, []);
});

test("webhook alert delivery posts structured alert payloads", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const result = await deliverOperationalAlert({
    severity: "critical",
    key: "platform-health-unavailable",
    message: "Platform health check failed.",
    env: { OPERATIONS_CRITICAL_WEBHOOK_URL: "https://alerts.example/critical" },
    fetchImpl: (async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response("ok", { status: 200 });
    }) as typeof fetch
  });

  assert.deepEqual(result, { delivered: true, channel: "operations-critical", status: 200 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://alerts.example/critical");
  assert.match(String(calls[0]?.init.body), /platform-health-unavailable/);
});

test("PITR, retention, deployment, and incident controls are complete", () => {
  assert.equal(validatePitrReadinessConfiguration().ok, true);
  assert.equal(validateRetentionConfiguration().ok, true);
  assert.equal(validateDeploymentWorkflow().ok, true);
  assert.equal(validateIncidentSeverityModel().ok, true);
  assert.equal(validateProductionHardening().ok, true);
});
