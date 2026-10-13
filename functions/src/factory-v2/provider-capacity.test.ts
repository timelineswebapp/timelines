import assert from "node:assert/strict";
import test from "node:test";
import { ProviderCapacityController, ProviderCapacityError, classifyProviderFailure, type ProviderCapacityPolicy } from "./provider-capacity";

const policy: ProviderCapacityPolicy = { maximumConcurrentOperations: 1, maximumAttempts: 3, minimumBackoffMs: 10, maximumBackoffMs: 40, maximumRetryTimeMs: 100, circuitFailureThreshold: 2, circuitCooldownMs: 20 };
const capacity = () => new ProviderCapacityController({ runId: "run-1", topicId: "topic-1", project: "project", model: "gemini-2.5-flash", location: "global", policy, random: () => 0.5, sleep: async () => undefined });
const operation = (stage = "SCOPE") => ({ logicalOperationId: "run-1:SCOPE:0", stage, deadlineAt: Date.now() + 1_000 });
const exhausted = () => Object.assign(new Error("Resource exhausted. Please try again later."), { status: 429, error: { code: 429, status: "RESOURCE_EXHAUSTED" } });

test("capacity controller permits a first successful call", async () => {
  const controller = capacity();
  assert.equal(await controller.execute({ ...operation(), run: async () => "ok" }), "ok");
  assert.equal(controller.telemetry.length, 1);
  assert.equal(controller.telemetry[0]!.classification, null);
});

test("capacity controller retries a transient 429 with stable logical identity", async () => {
  const controller = capacity(); let calls = 0;
  const result = await controller.execute({ ...operation(), run: async () => { calls += 1; if (calls === 1) throw exhausted(); return "ok"; } });
  assert.equal(result, "ok"); assert.equal(calls, 2);
  assert.deepEqual(controller.telemetry.map((item) => item.logicalOperationId), ["run-1:SCOPE:0", "run-1:SCOPE:0"]);
  assert.equal(controller.telemetry[0]!.classification, "TRANSIENT_CAPACITY");
  assert.ok((controller.telemetry[0]!.calculatedBackoffMs || 0) >= 0);
});

test("capacity controller respects Retry-After and fails closed after bounded attempts", async () => {
  const controller = capacity(); let calls = 0;
  const error = Object.assign(exhausted(), { headers: { "retry-after": "1" } });
  await assert.rejects(() => controller.execute({ ...operation(), run: async () => { calls += 1; throw error; } }), ProviderCapacityError);
  assert.ok(calls <= policy.maximumAttempts);
  assert.equal(controller.telemetry[0]!.retryAfterMs, 1_000);
});

test("provider taxonomy never calls generic RESOURCE_EXHAUSTED a quota exhaustion", () => {
  assert.equal(classifyProviderFailure(exhausted()).classification, "TRANSIENT_CAPACITY");
  assert.equal(classifyProviderFailure(Object.assign(new Error("quota limit exceeded"), { status: 429 })).classification, "QUOTA_EXHAUSTED");
  assert.equal(classifyProviderFailure(Object.assign(new Error("unauthenticated"), { status: 401 })).classification, "AUTHENTICATION");
  assert.equal(classifyProviderFailure(Object.assign(new Error("invalid"), { status: 400 })).classification, "INVALID_REQUEST");
});

test("shared provider key enforces the global admission ceiling", async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const first = new ProviderCapacityController({ runId: "run-a", topicId: "topic-a", project: "admission-project", model: "model", location: "global", policy, sleep: async () => undefined });
  const second = new ProviderCapacityController({ runId: "run-b", topicId: "topic-b", project: "admission-project", model: "model", location: "global", policy, sleep: async () => new Promise((resolve) => setTimeout(resolve, 1)) });
  let secondEntered = false;
  const one = first.execute({ logicalOperationId: "one", stage: "SCOPE", deadlineAt: Date.now() + 1_000, run: async () => { await gate; return "one"; } });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const two = second.execute({ logicalOperationId: "two", stage: "SCOPE", deadlineAt: Date.now() + 1_000, run: async () => { secondEntered = true; return "two"; } });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(secondEntered, false);
  release!();
  assert.deepEqual(await Promise.all([one, two]), ["one", "two"]);
});

test("authentication and invalid request failures are never retried", async () => {
  for (const error of [Object.assign(new Error("unauthenticated"), { status: 401 }), Object.assign(new Error("invalid"), { status: 400 })]) {
    const controller = capacity(); let calls = 0;
    await assert.rejects(() => controller.execute({ ...operation(), run: async () => { calls += 1; throw error; } }), ProviderCapacityError);
    assert.equal(calls, 1);
  }
});

test("circuit half-open success closes the provider/model/location circuit", async () => {
  let now = 1_000;
  const strict = { ...policy, circuitFailureThreshold: 1 };
  const input = { runId: "circuit-a", topicId: "topic", project: "circuit-success", model: "model", location: "global", policy: strict, now: () => now, sleep: async (ms: number) => { now += ms; } };
  const first = new ProviderCapacityController(input);
  await assert.rejects(() => first.execute({ logicalOperationId: "one", stage: "SCOPE", deadlineAt: now + 1_000, run: async () => { throw exhausted(); } }), ProviderCapacityError);
  now += strict.circuitCooldownMs;
  const second = new ProviderCapacityController({ ...input, runId: "circuit-b" });
  assert.equal(await second.execute({ logicalOperationId: "two", stage: "SCOPE", deadlineAt: now + 1_000, run: async () => "recovered" }), "recovered");
  assert.equal(second.telemetry[0]!.circuitState, "HALF_OPEN");
});

test("deadline prevents a capacity retry from starting", async () => {
  const controller = capacity(); let calls = 0;
  await assert.rejects(() => controller.execute({ logicalOperationId: "deadline", stage: "SCOPE", deadlineAt: Date.now() + 1, run: async () => { calls += 1; throw exhausted(); } }), ProviderCapacityError);
  assert.equal(calls, 1);
});
