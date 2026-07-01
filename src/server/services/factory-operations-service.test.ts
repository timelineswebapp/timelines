import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
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

test("Runtime V2 uses worker-scoped leases without process-local heartbeats", async () => {
  const [service, repository] = await Promise.all([
    readFile("src/server/services/factory-operations-service.ts", "utf8"),
    readFile("src/server/repositories/factory-operations-repository.ts", "utf8")
  ]);
  assert.match(service, /WORKER_LEASE_SECONDS = 180/);
  assert.doesNotMatch(service, /setInterval|WORKFLOW_HEARTBEAT_MS/);
  assert.match(service, /maxWorkers: 1/);
  assert.match(service, /topic\.status !== "running" \|\| topic\.leaseOwner !== workerId/);
  assert.match(repository, /lease_expires_at >= NOW\(\)/);
  assert.match(repository, /AND status='running' AND current_stage=\$\{topic\.currentStage\}/);
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
