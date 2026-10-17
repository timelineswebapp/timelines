import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Factory execution is exclusively cron-driven and leader-safe", async () => {
  const instrumentation = await readFile("instrumentation.ts", "utf8");
  const cron = await readFile("app/api/cron/factory/route.ts", "utf8");
  const dispatcher = await readFile("src/server/services/factory-dispatcher.ts", "utf8");
  assert.doesNotMatch(instrumentation, /setInterval|dispatcher\.start/);
  assert.match(cron, /dispatcher\.runCycle/);
  assert.match(cron, /factory_cron_started/);
  assert.match(cron, /factory_cron_completed/);
  assert.match(cron, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(cron, /databaseHostname/);
  assert.match(cron, /leasedWorkItemIds/);
  assert.match(dispatcher, /factoryOperationsService\.runCycle/);
});

test("institution schedulers preserve independent routes under GitHub orchestration", async () => {
  const factory = await readFile("app/api/cron/factory/route.ts", "utf8");
  const governance = await readFile("app/api/cron/governance/route.ts", "utf8");
  const maintenance = await readFile("app/api/cron/maintenance/route.ts", "utf8");
  const workflow = await readFile(".github/workflows/factory-scheduler.yml", "utf8");
  const vercelConfig = JSON.parse(await readFile("vercel.json", "utf8")) as {
    buildCommand?: unknown;
    crons?: unknown;
    installCommand?: unknown;
  };
  assert.match(factory, /FactoryDispatcher/);
  assert.doesNotMatch(factory, /governanceExecutionService|scheduledOperationsService/);
  assert.match(governance, /governanceExecutionService/);
  assert.doesNotMatch(governance, /FactoryDispatcher|scheduledOperationsService/);
  assert.match(maintenance, /scheduledOperationsService/);
  assert.doesNotMatch(maintenance, /FactoryDispatcher|governanceExecutionService/);
  assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /secrets\.TIMELINES_BASE_URL/);
  assert.match(workflow, /secrets\.CRON_SECRET/);
  assert.ok(workflow.indexOf("/api/cron/factory") < workflow.indexOf("/api/cron/governance"));
  assert.ok(workflow.indexOf("/api/cron/governance") < workflow.indexOf("/api/cron/maintenance"));
  assert.equal(vercelConfig.crons, undefined);
  assert.equal(vercelConfig.installCommand, "npm ci && npm --prefix functions ci");
  assert.equal(vercelConfig.buildCommand, "npm run build");
});

test("release gate verifies the two-lockfile Vercel contract before promotion", async () => {
  const workflow = await readFile(".github/workflows/tier1-release-gate.yml", "utf8");
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /npm ci && npm --prefix functions ci/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run security:gate/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm --prefix functions run build/);
  assert.match(workflow, /npm run serverless:functions:test/);
  assert.match(workflow, /actions\/checkout@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/setup-node@[a-f0-9]{40}/);
});

test("serverless deployment requires an explicit isolated target and infrastructure-mutation approval", async () => {
  const deployment = await readFile("infra/gcp/deploy-serverless.sh", "utf8");
  assert.match(deployment, /TIMELINES_ENVIRONMENT/);
  assert.match(deployment, /TIMELINES_GCP_PROJECT_ID/);
  assert.match(deployment, /TIMELINES_DEPLOY_ACCOUNT/);
  assert.match(deployment, /TIMELINES_STAGING_ISOLATION_VERIFIED/);
  assert.match(deployment, /TIMELINES_INFRASTRUCTURE_MUTATION_APPROVED/);
  assert.match(deployment, /Refusing staging deployment into the production project/);
  assert.match(deployment, /TIMELINES_ENABLE_PROVIDER_RESEARCH/);
  assert.match(deployment, /Refusing staging deployment: provider-backed research is not authorized/);
  assert.match(deployment, /gcloud firestore databases create/);
  assert.match(deployment, /--location=us-central1/);
  assert.match(deployment, /--soft-delete-duration=7d/);
  assert.match(deployment, /staging-archive-lifecycle\.json/);
  assert.match(deployment, /git diff --quiet/);
  assert.match(deployment, /gcloud scheduler jobs pause topic-discovery-daily/);
});

test("environment template documents every configured operational alert route", async () => {
  const environmentTemplate = await readFile(".env.example", "utf8");
  const routes = JSON.parse(await readFile("ops/alerts/delivery.json", "utf8")) as {
    routes?: Array<{ webhookEnv?: unknown }>;
  };
  for (const route of routes.routes ?? []) {
    assert.equal(typeof route.webhookEnv, "string");
    assert.match(environmentTemplate, new RegExp(`^${route.webhookEnv}=$`, "m"));
  }
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

test("Runtime V2 worker visibility changes share one atomic transaction and replay key", async () => {
  const database = await readFile("src/server/db/client.ts", "utf8");
  const service = await readFile("src/server/services/factory-service.ts", "utf8");
  const repository = await readFile("src/server/repositories/factory-repository.ts", "utf8");
  assert.match(database, /AsyncLocalStorage<Sql>/);
  assert.match(database, /sql\.begin/);
  assert.match(service, /withWriteTransaction\("committing Factory worker checkpoint"/);
  assert.match(service, /withWriteTransaction\("committing deterministic Factory worker checkpoint"/);
  assert.match(service, /executionKey = `\$\{run\.pipelineRunId\}:\$\{stepIndex\}:\$\{workerKey\}`/);
  assert.match(repository, /ON CONFLICT \(pipeline_run_id, step_index\) DO UPDATE/);
});

test("synthetic certification restores and executes the real institutional harness outside production", async () => {
  const script = await readFile("scripts/run-synthetic-publication-certification.ts", "utf8");
  assert.match(script, /ops:restore/);
  assert.match(script, /ops:publication:certify/);
  assert.match(script, /SYNTHETIC_CERTIFICATION/);
  assert.match(script, /databaseIdentity\(productionUrl\) === databaseIdentity\(syntheticUrl\)/);
});
