import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@/src/server/api/responses";
import { serverlessBackendClient } from "@/src/server/serverless/backend-client";
import { factoryV2AdminService } from "./factory-v2-admin-service";

test("Factory V2 Admin reads fail closed when a signed bridge returns a malformed DTO", async () => {
  const client = serverlessBackendClient as unknown as { listDeferredFactoryV2Topics: (limit?: number) => Promise<unknown> };
  const original = client.listDeferredFactoryV2Topics;
  client.listDeferredFactoryV2Topics = async () => [{ topicId: "topic-1", runId: "run-1", generation: "not-an-integer" }];
  try {
    await assert.rejects(factoryV2AdminService.listDeferredTopics(), (error: unknown) => error instanceof ApiError && error.status === 502 && error.code === "SERVERLESS_BACKEND_INVALID_RESPONSE");
  } finally {
    client.listDeferredFactoryV2Topics = original;
  }
});

test("Factory V2 Admin accepts the complete governed deferred-outcome contract", async () => {
  const client = serverlessBackendClient as unknown as { listDeferredFactoryV2Topics: (limit?: number) => Promise<unknown> };
  const original = client.listDeferredFactoryV2Topics;
  client.listDeferredFactoryV2Topics = async () => [{
    topicId: "topic-1", runId: "run-1", generation: 1, stage: "A1_SCHEMAS", updatedAt: "2026-11-27T06:00:00.000Z", terminalFailureRecordId: "failure-1",
    outcome: {
      policyVersion: "autonomous-public-evidence.1", classification: "PUBLIC_EVIDENCE_LIMITATION", disposition: "DEFERRED",
      reentryState: "REQUIRES_RELEVANT_CHANGE", detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED"
    },
    operationalFeasibility: {
      state: "REENTRY_CONDITION_REQUIRED", requiredCondition: "RELEVANT_EVIDENCE_CHANGE", terminalAt: "2026-11-27T06:00:00.000Z",
      attemptsConsumed: 4, budgetConsumed: { firestoreWrites: 10 }, failureClass: "FAILED_UNCLASSIFIED"
    },
    reentryRequests: []
  }];
  try {
    const records = await factoryV2AdminService.listDeferredTopics();
    assert.equal(records.length, 1);
    assert.equal(records[0]?.outcome.disposition, "DEFERRED");
  } finally {
    client.listDeferredFactoryV2Topics = original;
  }
});
