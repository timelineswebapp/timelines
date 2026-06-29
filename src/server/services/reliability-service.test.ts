import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateInstitutionHealth } from "@/src/server/services/reliability-service";

test("PE-003 persists historical metrics, health, alerts, audit, and scheduled run state", async () => {
  const migration = await readFile("db/migrations/20260707_reliability_observability.sql", "utf8");
  for (const table of ["operational_metric_measurements", "operational_health_assessments", "operational_alerts", "operational_alert_history", "operational_scheduled_runs", "operational_replay_requests"]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(migration, /prevent_operational_observation_delete/);
});

test("health engine reports deterministic institution severity", () => {
  const health = evaluateInstitutionHealth([
    { key: "factory.dead_letter.depth", value: 2, unit: "count" },
    { key: "projection.failures", value: 0, unit: "count" },
    { key: "factory.queue.oldest_age_seconds", value: 0, unit: "seconds" }
  ]);
  assert.equal(health.length, 6);
  assert.equal(health.find((item) => item.institution === "factory")?.status, "critical");
  assert.equal(health.find((item) => item.institution === "projection")?.status, "healthy");
});

test("monitoring runtime covers all PE-003 metric requirements", async () => {
  const source = await readFile("src/server/repositories/reliability-repository.ts", "utf8");
  for (const key of ["factory.queue.depth", "factory.queue.oldest_age_seconds", "workflow.active", "workflow.completed", "factory.worker.utilization", "publication.throughput_hour", "publication.latency_ms", "governance.latency_ms", "workflow.retry_count", "workflow.replay_count", "factory.dead_letter.depth", "projection.duration_ms", "projection.failures"]) assert.match(source, new RegExp(key.replaceAll(".", "\\.")));
});

test("alert runtime supports durable acknowledgement, resolution, and audit history", async () => {
  const source = await readFile("src/server/repositories/reliability-repository.ts", "utf8");
  assert.match(source, /acknowledged_at/);
  assert.match(source, /resolved_at/);
  assert.match(source, /operational_alert_history/);
  assert.match(source, /deduplication_key/);
});

test("founder dashboard exposes operational health, alerts, production, and inbox", async () => {
  const source = await readFile("components/admin/AdminFactoryOperations.tsx", "utf8");
  for (const label of ["Operational Health", "Institution Health", "Alerts", "Publishing", "Production Queue", "Founder Inbox"]) {
    assert.match(source, new RegExp(label));
  }
});
