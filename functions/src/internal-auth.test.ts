import assert from "node:assert/strict";
import test from "node:test";
import { internalRequestSignature, validInternalRequest } from "./internal-auth";

const secret = "a".repeat(32);
const timestamp = "1760572800000";

test("internal Function requests require an exact method, path, body, and bounded timestamp", () => {
  const signature = internalRequestSignature(secret, timestamp, "GET", "/internal/factory-v2/deferred");
  const valid = { secret, timestamp, signature, method: "GET", path: "/internal/factory-v2/deferred", now: Number(timestamp) + 1 };
  assert.equal(validInternalRequest(valid), true);
  assert.equal(validInternalRequest({ ...valid, path: "/internal/factory-v2/reentry" }), false);
  assert.equal(validInternalRequest({ ...valid, method: "POST" }), false);
  assert.equal(validInternalRequest({ ...valid, now: Number(timestamp) + 300_001 }), false);
});
