import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ApiError } from "@/src/server/api/responses";
import { workflowStages } from "@/src/server/factory-operations/contracts";

test("PE-001 defines workflow order and decision boundaries", async () => {
  assert.deepEqual(workflowStages, ["queued", "research", "extraction", "publication_candidate", "founder_review", "governance", "library_admission", "published", "completed"]);
  const source = await readFile("src/server/services/factory-operations-service.ts", "utf8");
  assert.match(source, /waitingStages.*founder_review.*governance/);
  assert.match(source, /INVALID_REPLAY_BOUNDARY/);
});

test("PE-001 schema provides durable recovery and immutable history", async () => {
  const migration = await readFile("db/migrations/20260705_factory_operations_foundation.sql", "utf8");
  for (const requirement of ["lease_owner", "lease_expires_at", "heartbeat_at", "retry_count", "max_retries", "dead_letter", "last_certified_stage", "factory_topic_execution_history"]) {
    assert.match(migration, new RegExp(requirement, "i"));
  }
  assert.match(migration, /prevent_factory_topic_history_mutation/);
});

test("dispatcher leasing is globally bounded and isolates locked work", async () => {
  const [repository, service] = await Promise.all([
    readFile("src/server/repositories/factory-operations-repository.ts", "utf8"),
    readFile("src/server/services/factory-operations-service.ts", "utf8")
  ]);
  assert.match(repository, /FOR UPDATE SKIP LOCKED/);
  assert.match(repository, /active\.count >= control\.concurrency/);
  assert.match(repository, /lease_expires_at < NOW\(\)/);
  assert.doesNotMatch(repository, /replaceAll\("id::text"/);
  assert.match(service, /return topic \? \{ topic, workerId \} : null/);
  assert.match(service, /leasedType: "factory_topic_work_item"/);
  assert.match(service, /factory_execution_skipped/);
  assert.match(service, /outcome\.outcome === "skipped"/);
  assert.doesNotMatch(service, /completed: topics\.length/);
});

test("Runtime V2 renews worker-scoped leases during long execution", async () => {
  const [service, repository] = await Promise.all([
    readFile("src/server/services/factory-operations-service.ts", "utf8"),
    readFile("src/server/repositories/factory-operations-repository.ts", "utf8")
  ]);
  assert.match(service, /WORKER_LEASE_SECONDS = 180/);
  assert.match(service, /WORKFLOW_HEARTBEAT_MS = 60_000/);
  assert.match(service, /repository\.heartbeat\(topic\.id, workerId, WORKER_LEASE_SECONDS\)/);
  assert.match(service, /await leaseHeartbeat\.stop\(\)/);
  assert.match(service, /leaseHeartbeat\.assertOwned\(\)/);
  assert.match(service, /maxWorkers: from === "research" \? undefined : 1/);
  assert.match(service, /topic\.status !== "running" \|\| topic\.leaseOwner !== workerId/);
  assert.match(repository, /lease_expires_at >= NOW\(\)/);
  assert.match(repository, /AND status='running' AND current_stage=\$\{topic\.currentStage\}/);
});

test("Factory operation failures expose existing provider diagnostics without changing retry flow", async () => {
  const [service, factory] = await Promise.all([
    readFile("src/server/services/factory-operations-service.ts", "utf8"),
    readFile("src/server/services/factory-service.ts", "utf8")
  ]);
  assert.match(factory, /event: "factory_pipeline_failed"/);
  assert.match(factory, /diagnostics: failure\.diagnostics/);
  assert.match(factory, /retryHistory: failure\.retryHistory/);
  assert.match(service, /function errorDetails\(error: unknown\): Record<string, unknown>/);
  assert.match(service, /details = errorDetails\(error\)/);
  assert.match(service, /appendHistory\(topic\.id,[\s\S]*details/);
  assert.match(service, /deduplicationKey: `\$\{topic\.workflowId\}:failure:\$\{from\}:\$\{topic\.retryCount \+ 1\}`,[\s\S]*details/);
  assert.match(service, /nextState: \{ status, stage: from \}, reason: message, details/);
});

test("lease heartbeat renews repeatedly and stops without leaving a duplicate executor", async () => {
  const { startLeaseHeartbeat } = await import("@/src/server/services/factory-operations-service");
  let renewals = 0;
  const heartbeat = startLeaseHeartbeat({
    intervalMs: 5,
    heartbeat: async () => {
      renewals += 1;
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 24));
  await heartbeat.stop();
  heartbeat.assertOwned();
  const stoppedAt = renewals;
  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.ok(stoppedAt >= 2);
  assert.equal(renewals, stoppedAt);
});

test("lease heartbeat propagates ownership loss", async () => {
  const { startLeaseHeartbeat } = await import("@/src/server/services/factory-operations-service");
  const expected = new ApiError(409, "LEASE_LOST", "lost");
  const heartbeat = startLeaseHeartbeat({
    intervalMs: 1,
    heartbeat: async () => {
      throw expected;
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 8));
  await heartbeat.stop();
  assert.throws(() => heartbeat.assertOwned(), (error) => error === expected);
});

test("EXECUTION-001 schedules replay atomically and retries failed stages only", async () => {
  const [service, repository] = await Promise.all([
    readFile("src/server/services/factory-operations-service.ts", "utf8"),
    readFile("src/server/repositories/factory-operations-repository.ts", "utf8")
  ]);
  assert.match(service, /RETRY_NOT_FAILED/);
  assert.match(service, /repository\.scheduleReplay/);
  assert.match(repository, /atomically scheduling workflow replay/);
  assert.match(repository, /FOR UPDATE/);
  assert.match(repository, /REPLAY_STAGE_ACTIVE/);
  assert.match(repository, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
});

test("Founder Operating System exposes operational controls without implementation language", async () => {
  const source = await readFile("components/admin/AdminFactoryOperations.tsx", "utf8");
  for (const label of ["Add Topics", "Queue Topics", "Production Queue", "Founder Inbox", "Operational Health", "Factory Mode"]) {
    assert.match(source, new RegExp(label));
  }
  assert.doesNotMatch(source, />Replay Boundary</);
  assert.doesNotMatch(source, />Run One Cycle</);
});

test("FOS-002A uses one Home read model and preserves certified workflow services", async () => {
  const [ui, service, repository, visitorRoute] = await Promise.all([
    readFile("components/admin/AdminFactoryOperations.tsx", "utf8"),
    readFile("src/server/services/founder-operations-service.ts", "utf8"),
    readFile("src/server/repositories/factory-operations-repository.ts", "utf8"),
    readFile("app/api/admin/founder/visitor-requests/approve/route.ts", "utf8")
  ]);
  assert.match(ui, /fetchAdmin<FounderHomeReadModel>\(\"\/api\/admin\/founder\/home\"\)/);
  assert.match(service, /factoryOperationsService\.mutateTopic/);
  assert.match(service, /getTopicBySourceReference\("public_request", sourceReference\)/);
  assert.match(service, /if \(stage === "extraction"\) return "Extraction in progress"/);
  assert.match(service, /if \(stage === "publication_candidate"\) return "Extraction completed"/);
  assert.match(repository, /source_reference=\$2/);
  assert.match(repository, /LIMIT \$\{Math\.max\(1, Math\.min\(50, limit\)\)\}/);
  assert.match(visitorRoute, /withAdminAuth/);
  assert.match(ui, /FOUNDER_HOME_REFRESH_MS = 5_000/);
  assert.match(ui, /refreshTimer = setTimeout\(refresh, FOUNDER_HOME_REFRESH_MS\)/);
  assert.match(ui, /clearTimeout\(refreshTimer\)/);
});

test("FOS-004 routine editorial policy preserves Governance authority", async () => {
  const [factory, operations] = await Promise.all([
    readFile("src/server/services/factory-service.ts", "utf8"),
    readFile("src/server/services/factory-operations-service.ts", "utf8")
  ]);
  for (const operation of [
    "validateCandidatePackage",
    "reviewCandidatePackage",
    "approveEditorialReview",
    "prepareAuthorityRecords",
    "assessGovernanceReadiness"
  ]) {
    assert.match(factory, new RegExp(`factoryService\\.${operation}`));
  }
  assert.match(operations, /applyEditorialReviewPolicy/);
  assert.match(operations, /submitToGovernance/);
  assert.match(operations, /governanceService\.submitPackage/);
  assert.doesNotMatch(factory, /governanceService\.approveDecision/);
});
