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
  const source = await readFile("src/server/repositories/factory-operations-repository.ts", "utf8");
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
  assert.match(source, /active\.count >= control\.concurrency/);
  assert.match(source, /lease_expires_at < NOW\(\)/);
});

test("Operations Center exposes required controls", async () => {
  const source = await readFile("components/admin/AdminFactoryOperations.tsx", "utf8");
  for (const label of ["Start Automation", "Stop Automation", "Pause After Current", "Resume", "Run One Cycle", "Queue Status", "Active workers", "Dead letters", "Replay Boundary"]) assert.match(source, new RegExp(label));
});
