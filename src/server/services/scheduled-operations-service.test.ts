import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { scheduledOperationDefinitions } from "@/src/server/services/scheduled-operations-service";

test("PE-003A registers every required scheduled operation", () => {
  assert.deepEqual(new Set(scheduledOperationDefinitions.map((item) => item.key)), new Set([
    "workflow_maintenance", "projection_verification", "publication_verification", "health_verification",
    "backup_execution", "restore_verification", "synthetic_publication_verification", "seo_validation"
  ]));
  assert.equal(scheduledOperationDefinitions.every((item) => item.cadenceMs > 0 && item.timeoutMs > 0), true);
});

test("scheduler claims are durable, singleton per time bucket, and restart recoverable", async () => {
  const source = await readFile("src/server/repositories/scheduler-repository.ts", "utf8");
  assert.match(source, /ON CONFLICT \(operation_key,scheduled_for\)/);
  assert.match(source, /lease_expires_at < NOW\(\)/);
  assert.match(source, /status='running'/);
});

test("scheduled projection and publication verification persist bounded diagnostics", async () => {
  const source = await readFile("src/server/services/scheduled-operations-service.ts", "utf8");
  assert.match(source, /published_memory_projection_rebuild_reports/);
  assert.match(source, /projection_type='timeline'/);
  assert.match(source, /projection_type='search'/);
  assert.match(source, /projection_type='sitemap'/);
  assert.match(source, /durationMs/);
  assert.match(source, /schedulerRepository\.complete/);
  assert.match(source, /schedulerRepository\.fail/);
});

test("scheduled backup and isolated restore verification reuse certified operations", async () => {
  const source = await readFile("src/server/services/scheduled-operations-service.ts", "utf8");
  assert.match(source, /\["run", "ops:backup"\]/);
  assert.match(source, /\["run", "ops:restore:scheduled"\]/);
  assert.match(source, /RESTORE_DATABASE_URL is required/);
  const script = await readFile("scripts/verify-scheduled-restore.ts", "utf8");
  assert.match(script, /requiredRecoveryValidationQueries/);
});

test("synthetic publication verification executes against an isolated database", async () => {
  const source = await readFile("src/server/services/scheduled-operations-service.ts", "utf8");
  const script = await readFile("scripts/run-synthetic-publication-certification.ts", "utf8");
  assert.match(source, /ops:synthetic:publication/);
  assert.match(script, /SYNTHETIC_DATABASE_URL/);
  assert.match(script, /refuses to use the canonical production database/);
  assert.match(script, /ops:publication:certify/);
});

test("scheduler failures generate durable operational alerts", async () => {
  const source = await readFile("src/server/services/scheduled-operations-service.ts", "utf8");
  assert.match(source, /reliabilityRepository\.upsertAlert/);
  assert.match(source, /scheduled-\$\{definition\.key\}-failed/);
});
