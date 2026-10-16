import assert from "node:assert/strict";
import test from "node:test";
import { sourceSubmissionDispatchSchema } from "./source-submission-dispatch";

test("source submission dispatch requires bounded candidate identity and a sealed timestamp", () => {
  assert.equal(sourceSubmissionDispatchSchema.parse({ candidateId: "candidate-001", dispatchedAt: "2026-10-16T04:00:00.000Z" }).candidateId, "candidate-001");
  assert.throws(() => sourceSubmissionDispatchSchema.parse({ candidateId: "candidate-001" }), /dispatchedAt/);
  assert.throws(() => sourceSubmissionDispatchSchema.parse({ candidateId: "invalid id", dispatchedAt: "2026-10-16T04:00:00.000Z" }), /Invalid/);
});
