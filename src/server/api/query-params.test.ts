import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@/src/server/api/responses";
import { parseOptionalEnumQueryParameter, parseOptionalSingleQueryParameter } from "@/src/server/api/query-params";

test("operational enum filters accept only one declared value", () => {
  const options = ["queued", "running", "completed"] as const;
  assert.equal(parseOptionalEnumQueryParameter(new URLSearchParams(), "status", options), undefined);
  assert.equal(parseOptionalEnumQueryParameter(new URLSearchParams("status=queued"), "status", options), "queued");
  assert.throws(() => parseOptionalEnumQueryParameter(new URLSearchParams("status=unknown"), "status", options), ApiError);
  assert.throws(() => parseOptionalEnumQueryParameter(new URLSearchParams("status=queued&status=running"), "status", options), ApiError);
  assert.throws(() => parseOptionalEnumQueryParameter(new URLSearchParams("status=&status=queued"), "status", options), ApiError);
});

test("single operational controls reject parameter pollution without coercion", () => {
  assert.equal(parseOptionalSingleQueryParameter(new URLSearchParams("jobId=abc"), "jobId"), "abc");
  assert.equal(parseOptionalSingleQueryParameter(new URLSearchParams(), "jobId"), undefined);
  assert.throws(() => parseOptionalSingleQueryParameter(new URLSearchParams("jobId=a&jobId=b"), "jobId"), ApiError);
});
