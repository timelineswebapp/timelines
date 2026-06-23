import test from "node:test";
import assert from "node:assert/strict";
import { config } from "@/src/lib/config";
import { withAdminAuth } from "@/src/server/api/admin-auth";
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
