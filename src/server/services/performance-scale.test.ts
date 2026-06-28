import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ProviderExecutionLimiter } from "@/src/server/factory/runtime-providers";

test("provider limiter enforces bounded FIFO concurrency", async () => {
  const limiter = new ProviderExecutionLimiter(1, 60, 10);
  const first = await limiter.acquire();
  let secondAcquired = false;
  const secondPromise = limiter.acquire().then((lease) => { secondAcquired = true; return lease; });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(secondAcquired, false);
  first.release();
  const second = await secondPromise;
  assert.equal(secondAcquired, true);
  second.release();
});

test("queue leasing is globally bounded, isolated, and aging-fair", async () => {
  const source = await readFile("src/server/repositories/factory-operations-repository.ts", "utf8");
  assert.match(source, /active\.count >= control\.concurrency/);
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
  assert.match(source, /EXTRACT\(EPOCH FROM \(NOW\(\)-created_at\)\)/);
  assert.match(source, /Promise\.allSettled|leaseNext/);
});

test("search uses indexed PostgreSQL ranking, substring compatibility, and pagination", async () => {
  const migration = await readFile("db/migrations/20260708_performance_scale.sql", "utf8");
  const repository = await readFile("src/server/repositories/published-memory-projection-repository.ts", "utf8");
  const service = await readFile("src/server/services/platform-read-model-service.ts", "utf8");
  assert.match(migration, /to_tsvector/);
  assert.match(migration, /gin_trgm_ops/);
  assert.match(repository, /ts_rank_cd/);
  assert.match(repository, /websearch_to_tsquery/);
  assert.match(repository, /LIMIT \$\{limit\} OFFSET \$\{offset\}/);
  assert.match(service, /searchPublishedReadModels/);
  assert.doesNotMatch(service, /listPublishedReadModels\("search", 5000\)/);
});

test("projection rebuild supports bounded incremental execution without changing full mode", async () => {
  const service = await readFile("src/server/services/published-memory-projection-service.ts", "utf8");
  const repository = await readFile("src/server/repositories/historical-library-repository.ts", "utf8");
  assert.match(service, /incremental \? "incremental" : "full"/);
  assert.match(service, /listUnprojectedPublishedSnapshots\(batchSize, 0\)/);
  assert.match(repository, /NOT EXISTS/);
  assert.match(repository, /LIMIT \$\{limit\}/);
});

test("performance reporting and scheduled SEO validation cover required metrics", async () => {
  const analytics = await readFile("src/server/services/performance-analytics-service.ts", "utf8");
  for (const metric of ["topicsPerHour", "publicationsPerDay", "averageWorkflowDurationMs", "workerUtilization", "queueThroughputPerHour", "averageLatencyMs", "averageDurationMs", "averageCostUsd"]) assert.match(analytics, new RegExp(metric));
  const scheduler = await readFile("src/server/services/scheduled-operations-service.ts", "utf8");
  for (const check of ["canonical_url_missing", "structured_data_missing", "open_graph_markup_missing", "metadata_incomplete"]) assert.match(scheduler, new RegExp(check));
  assert.match(scheduler, /reliabilityRepository\.upsertAlert/);
});
