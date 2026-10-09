import assert from "node:assert/strict";
import test from "node:test";
import { AuthorityFirstExecutionSupervisor, ChildOperationDeadlineExceededError, WholeRunDeadlineExceededError } from "./execution-supervisor";

test("a local child timeout aborts only that operation and preserves the whole-run allowance", async () => {
  const supervisor = new AuthorityFirstExecutionSupervisor(Date.now(), Date.now() + 1_000, 1);
  await assert.rejects(supervisor.runChild({
    name: "bounded-provider",
    maximumMs: 10,
    run: async (signal) => await new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))
  }), ChildOperationDeadlineExceededError);
  assert.equal(supervisor.status, "ACTIVE");
  await supervisor.runChild({ name: "next-budgeted-operation", maximumMs: 10, run: async () => undefined });
  supervisor.close();
});

test("non-cooperative child cannot retain supervised control beyond its allowance", async () => {
  const supervisor = new AuthorityFirstExecutionSupervisor(Date.now(), Date.now() + 25, 1);
  const startedAt = Date.now();
  await assert.rejects(supervisor.runChild({ name: "provider", maximumMs: 25, run: async () => await new Promise<never>(() => undefined) }), WholeRunDeadlineExceededError);
  assert.ok(Date.now() - startedAt < 500);
  await supervisor.awaitShutdownGrace();
  assert.equal(supervisor.terminalSnapshot().shutdownGraceOutcome, "EXPIRED");
  supervisor.close();
});

test("no child may start after cancellation and late completion is ignored", async () => {
  const supervisor = new AuthorityFirstExecutionSupervisor(Date.now(), Date.now() + 15, 1);
  let resolve!: () => void;
  const delayed = supervisor.runChild({ name: "retrieval", maximumMs: 15, run: async () => await new Promise<void>((done) => { resolve = done; }) });
  await assert.rejects(delayed, WholeRunDeadlineExceededError);
  await assert.rejects(supervisor.runChild({ name: "late", maximumMs: 1, run: async () => undefined }), WholeRunDeadlineExceededError);
  resolve();
  await new Promise((done) => setTimeout(done, 1));
  assert.deepEqual(supervisor.terminalSnapshot().lateCompletionsIgnored, ["retrieval#1"]);
  supervisor.close();
});

test("retry that cannot preserve shutdown grace is not started", () => {
  const supervisor = new AuthorityFirstExecutionSupervisor(Date.now(), Date.now() + 20, 10);
  assert.throws(() => supervisor.assertMayStartRetry("provider", 20), WholeRunDeadlineExceededError);
  assert.equal(supervisor.status, "CANCELLING");
  supervisor.close();
});

test("a provider that honors abort settles within the recorded shutdown grace", async () => {
  const supervisor = new AuthorityFirstExecutionSupervisor(Date.now(), Date.now() + 15, 30);
  await assert.rejects(supervisor.runChild({
    name: "provider-honors-abort",
    maximumMs: 15,
    run: async (signal) => await new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))
  }), WholeRunDeadlineExceededError);
  await supervisor.awaitShutdownGrace();
  assert.equal(supervisor.terminalSnapshot().shutdownGraceOutcome, "SETTLED");
  supervisor.close();
});
