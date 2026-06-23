import test from "node:test";
import assert from "node:assert/strict";
import { applySecurityHeaders } from "@/src/server/security/security-headers";

test("security headers include clickjacking and CSP protections", () => {
  const headers = new Headers();

  applySecurityHeaders(headers);

  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  assert.match(headers.get("content-security-policy") || "", /object-src 'none'/);
});
