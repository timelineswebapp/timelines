import assert from "node:assert/strict";
import test from "node:test";
import { factoryOperationalAvailabilityMessage } from "@/components/admin/factory-operational-availability";

test("only typed serverless availability failures permit a degraded operational read", () => {
  for (const code of ["SERVERLESS_BACKEND_UNAVAILABLE", "SERVERLESS_BACKEND_INVALID_RESPONSE"]) {
    assert.match(factoryOperationalAvailabilityMessage({ code }) || "", /temporarily unavailable/u);
  }
  assert.equal(factoryOperationalAvailabilityMessage({ code: "FORBIDDEN" }), null);
  assert.equal(factoryOperationalAvailabilityMessage(new Error("network failure")), null);
  assert.equal(factoryOperationalAvailabilityMessage(null), null);
});
