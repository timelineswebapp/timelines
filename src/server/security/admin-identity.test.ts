import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { config } from "@/src/lib/config";
import {
  auditAdminSecurityEvent,
  browserCsrfProtectionApplies,
  csrfTokenValid,
  identityHasAnyRole,
  parseAdminOperatorTokens,
  resetAdminSecurityStateForTests,
  resolveAdminIdentity,
  revokeAdminSession,
  setAdminSecurityAuditStoreForTests,
  setAdminSessionRevocationStoreForTests
} from "@/src/server/security/admin-identity";

test("operator token configuration parses roles and MFA state", () => {
  const [operator] = parseAdminOperatorTokens("operator-1|admin,auditor|secret-token|Primary Operator|mfa");

  assert.equal(operator?.operatorId, "operator-1");
  assert.deepEqual(operator?.roles, ["admin", "auditor"]);
  assert.equal(operator?.displayName, "Primary Operator");
  assert.equal(operator?.mfaVerified, true);
});

test("legacy admin token remains authorized as super admin", async () => {
  const previousToken = config.adminApiToken;
  config.adminApiToken = "legacy-secret";

  try {
    const identity = await resolveAdminIdentity(
      new Request("https://timelines.example/api/admin/analytics", {
        headers: { authorization: "Bearer legacy-secret" }
      })
    );

    assert.equal(identity?.operatorId, "legacy-admin-token");
    assert.equal(identity?.authMethod, "legacy_token");
    assert.equal(identityHasAnyRole(identity!, ["governance_operator"]), true);
  } finally {
    config.adminApiToken = previousToken;
  }
});

test("operator token resolves attributable admin identity", async () => {
  const previousTokens = config.adminOperatorTokens;
  config.adminOperatorTokens = "operator-2|factory_operator,automation|operator-secret|Factory Operator|true";

  try {
    const identity = await resolveAdminIdentity(
      new Request("https://timelines.example/api/admin/factory/runtime/jobs", {
        headers: { "x-admin-token": "operator-secret" }
      })
    );

    assert.equal(identity?.operatorId, "operator-2");
    assert.equal(identity?.authMethod, "operator_token");
    assert.deepEqual(identity?.roles, ["factory_operator", "automation"]);
    assert.equal(identity?.mfaVerified, true);
    assert.equal(identityHasAnyRole(identity!, ["factory_operator"]), true);
    assert.equal(identityHasAnyRole(identity!, ["governance_operator"]), false);
  } finally {
    config.adminOperatorTokens = previousTokens;
  }
});

function signedSessionCookie(payload: Record<string, unknown>, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `timelines_admin_session=${encoded}.${signature}`;
}

test("signed admin session resolves identity with expiry and roles", async () => {
  const previousSecret = config.adminSessionSecret;
  config.adminSessionSecret = "session-secret";
  setAdminSessionRevocationStoreForTests(null);

  try {
    const identity = await resolveAdminIdentity(
      new Request("https://timelines.example/api/admin/analytics", {
        headers: {
          cookie: signedSessionCookie(
            {
              operatorId: "session-operator",
              displayName: "Session Operator",
              roles: ["admin"],
              exp: Date.now() + 60_000,
              sessionId: "session-1",
              mfaVerified: true
            },
            "session-secret"
          )
        }
      })
    );

    assert.equal(identity?.operatorId, "session-operator");
    assert.equal(identity?.authMethod, "session");
    assert.equal(identity?.sessionId, "session-1");
    assert.equal(identity?.mfaVerified, true);
  } finally {
    config.adminSessionSecret = previousSecret;
    setAdminSessionRevocationStoreForTests(null);
  }
});

test("expired admin sessions do not resolve identity", async () => {
  const previousSecret = config.adminSessionSecret;
  config.adminSessionSecret = "session-secret";
  setAdminSessionRevocationStoreForTests(null);

  try {
    const identity = await resolveAdminIdentity(
      new Request("https://timelines.example/api/admin/analytics", {
        headers: {
          cookie: signedSessionCookie(
            {
              operatorId: "expired-operator",
              roles: ["admin"],
              exp: Date.now() - 1_000
            },
            "session-secret"
          )
        }
      })
    );

    assert.equal(identity, null);
  } finally {
    config.adminSessionSecret = previousSecret;
    setAdminSessionRevocationStoreForTests(null);
  }
});

test("revoked admin sessions do not resolve identity", async () => {
  const previousSecret = config.adminSessionSecret;
  config.adminSessionSecret = "session-secret";
  resetAdminSecurityStateForTests();
  const revoked = new Set<string>();
  setAdminSessionRevocationStoreForTests({
    async revoke(input) {
      revoked.add(input.sessionId);
      return {
        sessionId: input.sessionId,
        operatorId: input.operatorId ?? null,
        reason: input.reason ?? null,
        revokedAt: Date.now()
      };
    },
    async isRevoked(sessionId) {
      return revoked.has(sessionId);
    }
  });

  try {
    await revokeAdminSession({ sessionId: "session-2", operatorId: "session-operator", reason: "test revocation" });
    const identity = await resolveAdminIdentity(
      new Request("https://timelines.example/api/admin/analytics", {
        headers: {
          cookie: signedSessionCookie(
            {
              operatorId: "session-operator",
              roles: ["admin"],
              exp: Date.now() + 60_000,
              sessionId: "session-2"
            },
            "session-secret"
          )
        }
      })
    );

    assert.equal(identity, null);
  } finally {
    config.adminSessionSecret = previousSecret;
    setAdminSessionRevocationStoreForTests(null);
    resetAdminSecurityStateForTests();
  }
});

test("security audit events append to configured storage", async () => {
  const records: unknown[] = [];
  setAdminSecurityAuditStoreForTests({
    async append(record) {
      records.push(record);
    }
  });

  try {
    const request = new Request("https://timelines.example/api/admin/analytics", { method: "GET" });
    auditAdminSecurityEvent("admin_auth_failed", request, null, { reason: "missing credentials" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(records.length, 1);
  } finally {
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("invalid admin token does not resolve identity", async () => {
  const identity = await resolveAdminIdentity(
    new Request("https://timelines.example/api/admin/analytics", {
      headers: { authorization: "Bearer invalid" }
    })
  );

  assert.equal(identity, null);
});

test("CSRF validation applies to unsafe browser cookie requests", () => {
  const request = new Request("https://timelines.example/api/admin/timelines", {
    method: "POST",
    headers: {
      cookie: "timelines_admin_csrf=csrf-token",
      "x-csrf-token": "csrf-token"
    }
  });

  assert.equal(browserCsrfProtectionApplies(request), true);
  assert.equal(csrfTokenValid(request), true);
});

test("CSRF validation rejects mismatched browser cookie tokens", () => {
  const request = new Request("https://timelines.example/api/admin/timelines", {
    method: "PATCH",
    headers: {
      cookie: "timelines_admin_csrf=csrf-token",
      "x-csrf-token": "different-token"
    }
  });

  assert.equal(browserCsrfProtectionApplies(request), true);
  assert.equal(csrfTokenValid(request), false);
});

test("CSRF validation does not block header-token automation without cookies", () => {
  const request = new Request("https://timelines.example/api/admin/timelines", {
    method: "POST",
    headers: {
      authorization: "Bearer automation-token"
    }
  });

  assert.equal(browserCsrfProtectionApplies(request), false);
  assert.equal(csrfTokenValid(request), true);
});
