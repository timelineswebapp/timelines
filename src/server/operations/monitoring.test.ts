import test from "node:test";
import assert from "node:assert/strict";
import { alertDefinitions, operationalMetrics, validateMonitoringConfiguration } from "@/src/server/operations/monitoring";

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
  assert.ok(alertDefinitions.length >= 7);
});
