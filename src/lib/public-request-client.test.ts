import assert from "node:assert/strict";
import test from "node:test";
import { readPublicRequestResponse } from "./public-request-client";

test("public request response parser accepts only successful enveloped data", async () => {
  const result = await readPublicRequestResponse<{ status: string }>(new Response(JSON.stringify({ ok: true, data: { status: "QUEUED" } }), { status: 202, headers: { "content-type": "application/json" } }));
  assert.deepEqual(result, { status: "QUEUED" });
});

test("public request response parser sanitizes malformed and unavailable responses", async () => {
  await assert.rejects(readPublicRequestResponse(new Response("not-json", { status: 503 })), /Topic intake is temporarily unavailable/);
  await assert.rejects(readPublicRequestResponse(new Response(JSON.stringify({ ok: false, error: { message: "raw backend diagnostic" } }), { status: 500 })), /Unable to submit request/);
  await assert.rejects(readPublicRequestResponse(new Response(JSON.stringify({ ok: true }), { status: 200 })), /Unable to submit request/);
});
