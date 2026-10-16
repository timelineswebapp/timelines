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
