import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "@/src/lib/config";
import { checkAdminRateLimit, resetAdminRateLimitStoreForTests, withAdminAuth } from "@/src/server/api/admin-auth";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";

test("withAdminAuth rejects operators without required role", async () => {
  const previousTokens = config.adminOperatorTokens;
  config.adminOperatorTokens = "operator-1|factory_operator|operator-secret|Factory Operator|true";
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const handler = withAdminAuth(async () => Response.json({ ok: true }), { roles: ["governance_operator"] });
    const response = await handler(
      new Request("https://timelines.example/api/admin/governance/operations", {
        headers: { authorization: "Bearer operator-secret" }
      }),
      {}
    );

    assert.equal(response.status, 403);
  } finally {
    config.adminOperatorTokens = previousTokens;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("withAdminAuth rejects a non-MFA operator in production before the handler runs", async () => {
  const previousTokens = config.adminOperatorTokens;
  const previousIsProduction = config.isProduction;
  let handlerCalled = false;
  config.adminOperatorTokens = "operator-1|admin|operator-secret|Primary Operator|false";
  config.isProduction = true;
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const handler = withAdminAuth(async () => {
      handlerCalled = true;
      return Response.json({ ok: true });
    }, { roles: ["admin"] });
    const response = await handler(
      new Request("https://timelines.example/api/admin/analytics", {
        headers: { authorization: "Bearer operator-secret" }
      }),
      {}
    );

    assert.equal(response.status, 403);
    assert.equal((await response.json() as { error?: { code?: string } }).error?.code, "MFA_REQUIRED");
    assert.equal(handlerCalled, false);
  } finally {
    config.adminOperatorTokens = previousTokens;
    config.isProduction = previousIsProduction;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("withAdminAuth allows super admin across route role requirements", async () => {
  const previousToken = config.adminApiToken;
  config.adminApiToken = "legacy-secret";
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const handler = withAdminAuth(async () => Response.json({ ok: true }), { roles: ["library_operator"] });
    const response = await handler(
      new Request("https://timelines.example/api/admin/historical-library/projections/rebuild", {
        headers: { authorization: "Bearer legacy-secret" }
      }),
      {}
    );

    assert.equal(response.status, 200);
  } finally {
    config.adminApiToken = previousToken;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("withAdminAuth issues an admin CSRF cookie after successful authentication", async () => {
  const previousToken = config.adminApiToken;
  config.adminApiToken = "legacy-secret";
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const handler = withAdminAuth(async () => Response.json({ ok: true, data: { ready: true } }), { roles: ["admin"] });
    const response = await handler(
      new Request("https://timelines.example/api/admin/analytics", {
        headers: {
          authorization: "Bearer legacy-secret",
          "x-forwarded-for": "192.0.2.10"
        }
      }),
      {}
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") || "", /timelines_admin_csrf=/);
    assert.match(response.headers.get("set-cookie") || "", /SameSite=Strict/);
  } finally {
    config.adminApiToken = previousToken;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("withAdminAuth replaces malformed CSRF cookies without failing an authenticated request", async () => {
  const previousToken = config.adminApiToken;
  config.adminApiToken = "legacy-secret";
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const handler = withAdminAuth(async () => Response.json({ ok: true }), { roles: ["admin"] });
    const response = await handler(
      new Request("https://timelines.example/api/admin/analytics", {
        headers: { authorization: "Bearer legacy-secret", cookie: "timelines_admin_csrf=%E0%A4%A" }
      }),
      {}
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") || "", /timelines_admin_csrf=/);
    assert.doesNotMatch(response.headers.get("set-cookie") || "", /%E0%A4%A/);
  } finally {
    config.adminApiToken = previousToken;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("withAdminAuth rejects unsafe browser admin requests missing CSRF token", async () => {
  const previousToken = config.adminApiToken;
  config.adminApiToken = "legacy-secret";
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const handler = withAdminAuth(async () => Response.json({ ok: true, data: { created: true } }), { roles: ["admin"] });
    const response = await handler(
      new Request("https://timelines.example/api/admin/timelines", {
        method: "POST",
        headers: {
          authorization: "Bearer legacy-secret",
          cookie: "timelines_admin_csrf=csrf-token",
          "x-forwarded-for": "192.0.2.11"
        }
      }),
      {}
    );

    const payload = await response.json() as { error?: { code?: string } };
    assert.equal(response.status, 403);
    assert.equal(payload.error?.code, "CSRF_REJECTED");
  } finally {
    config.adminApiToken = previousToken;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("withAdminAuth rejects unsafe requests with duplicate CSRF cookie values", async () => {
  const previousToken = config.adminApiToken;
  config.adminApiToken = "legacy-secret";
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const handler = withAdminAuth(async () => Response.json({ ok: true }), { roles: ["admin"] });
    const response = await handler(
      new Request("https://timelines.example/api/admin/timelines", {
        method: "POST",
        headers: {
          authorization: "Bearer legacy-secret",
          cookie: "timelines_admin_csrf=expected; timelines_admin_csrf=attacker",
          "x-csrf-token": "expected"
        }
      }),
      {}
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json() as { error?: { code?: string } }).error?.code, "CSRF_REJECTED");
  } finally {
    config.adminApiToken = previousToken;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("withAdminAuth accepts unsafe browser admin requests with matching CSRF token", async () => {
  const previousToken = config.adminApiToken;
  config.adminApiToken = "legacy-secret";
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const handler = withAdminAuth(async () => Response.json({ ok: true, data: { created: true } }), { roles: ["admin"] });
    const response = await handler(
      new Request("https://timelines.example/api/admin/timelines", {
        method: "POST",
        headers: {
          authorization: "Bearer legacy-secret",
          cookie: "timelines_admin_csrf=csrf-token",
          "x-csrf-token": "csrf-token",
          "x-forwarded-for": "192.0.2.12"
        }
      }),
      {}
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") || "", /timelines_admin_csrf=csrf-token/);
  } finally {
    config.adminApiToken = previousToken;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("AdminDashboard propagates CSRF token through shared unsafe admin fetches", () => {
  const dashboard = readFileSync("components/admin/AdminDashboard.tsx", "utf8");

  assert.match(dashboard, /UNSAFE_ADMIN_METHODS/);
  assert.match(dashboard, /"POST", "PUT", "PATCH", "DELETE"/);
  assert.match(dashboard, /readCookieValue\(ADMIN_CSRF_COOKIE_NAME\)/);
  assert.match(dashboard, /"x-csrf-token"/);
  assert.match(dashboard, /\.\.\.csrfHeadersFor\(init\)/);
});

test("admin rate limiting bounds distinct client keys without scanning on every request", () => {
  resetAdminRateLimitStoreForTests();
  try {
    for (let index = 0; index < 4_096; index += 1) {
      const clientIp = `198.51.${Math.floor(index / 256)}.${index % 256}`;
      const request = new Request("https://timelines.example/api/admin/analytics", { headers: { "x-forwarded-for": clientIp } });
      assert.deepEqual(checkAdminRateLimit(request), { allowed: true });
    }
    const overflow = new Request("https://timelines.example/api/admin/analytics", { headers: { "x-forwarded-for": "203.0.113.250" } });
    assert.deepEqual(checkAdminRateLimit(overflow), { allowed: false, retryAfter: 1 });
  } finally {
    resetAdminRateLimitStoreForTests();
  }
});
