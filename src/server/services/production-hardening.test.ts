import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Factory execution is exclusively cron-driven and leader-safe", async () => {
  const instrumentation = await readFile("instrumentation.ts", "utf8");
  const cron = await readFile("app/api/cron/operations/route.ts", "utf8");
  const dispatcher = await readFile("src/server/services/factory-dispatcher.ts", "utf8");
  assert.doesNotMatch(instrumentation, /setInterval|dispatcher\.start/);
  assert.match(cron, /dispatcher\.runCycle/);
  assert.match(dispatcher, /factoryOperationsService\.runCycle/);
});

test("provider coordination uses shared PostgreSQL leases and rate windows", async () => {
  const migration = await readFile("db/migrations/20260709_production_hardening.sql", "utf8");
  const repository = await readFile("src/server/repositories/provider-coordination-repository.ts", "utf8");
  const provider = await readFile("src/server/factory/runtime-providers.ts", "utf8");
  assert.match(migration, /provider_execution_leases/);
  assert.match(migration, /provider_rate_limit_events/);
  assert.match(repository, /FOR UPDATE/);
  assert.match(repository, /expires_at < NOW\(\)/);
  assert.match(provider, /providerCoordinationRepository\.acquire/);
});

test("waiting workflow reconciliation queries actionable waits independently", async () => {
  const repository = await readFile("src/server/repositories/factory-operations-repository.ts", "utf8");
  const service = await readFile("src/server/services/factory-operations-service.ts", "utf8");
  assert.match(repository, /listActionableWaitingTopics/);
  assert.match(repository, /t\.status='waiting'/);
  assert.match(repository, /r\.lifecycle='governance_ready'/);
  assert.match(repository, /p\.lifecycle IN \('accepted','published'\)/);
  assert.match(service, /listActionableWaitingTopics\(control\.concurrency \* 4\)/);
});

test("synthetic certification restores and executes the real institutional harness outside production", async () => {
  const script = await readFile("scripts/run-synthetic-publication-certification.ts", "utf8");
  assert.match(script, /ops:restore/);
  assert.match(script, /ops:publication:certify/);
  assert.match(script, /SYNTHETIC_CERTIFICATION/);
  assert.match(script, /databaseIdentity\(productionUrl\) === databaseIdentity\(syntheticUrl\)/);
});
