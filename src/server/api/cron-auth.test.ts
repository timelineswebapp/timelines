import assert from "node:assert/strict";
import test from "node:test";
import { authenticateCronRequest } from "./cron-auth";

function authenticate(authorization?: string) {
  return authenticateCronRequest(
    new Request("https://example.test/api/cron/factory", {
      headers: authorization ? { authorization } : undefined
    })
  );
}

test("cron authentication authorizes an exact bearer secret without diagnostics", () => {
  process.env.CRON_SECRET = "certification-secret";
  assert.deepEqual(authenticate("Bearer certification-secret"), { authorized: true });
});

test("cron authentication reports non-secret failure diagnostics", () => {
  process.env.CRON_SECRET = "certification-secret";

  assert.deepEqual(authenticate(), {
    authorized: false,
    diagnostics: {
      environmentSecretExists: true,
      environmentSecretLength: 20,
      authorizationHeaderExists: false,
      suppliedBearerTokenLength: 0,
      bearerParsingSucceeded: false,
      failure: "missing_authorization_header"
    }
  });

  assert.equal(authenticate("Basic certification-secret").authorized, false);
  assert.equal(authenticate("Bearer wrong-length").authorized, false);
  assert.equal(authenticate("Bearer certification-secreu").authorized, false);
});

test("cron authentication reports a missing runtime secret", () => {
  delete process.env.CRON_SECRET;
  const result = authenticate("Bearer supplied-secret");
  assert.equal(result.authorized, false);
  if (!result.authorized) {
    assert.equal(result.diagnostics.failure, "missing_environment_secret");
    assert.equal(result.diagnostics.environmentSecretExists, false);
    assert.equal(result.diagnostics.environmentSecretLength, 0);
  }
});
