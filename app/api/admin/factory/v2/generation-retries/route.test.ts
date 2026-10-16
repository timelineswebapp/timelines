import assert from "node:assert/strict";
import test from "node:test";
import { config } from "@/src/lib/config";
import { adminService } from "@/src/server/services/admin-service";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";
import { GET } from "./route";

test("scheduled retry visibility requires a factory operator and keeps its list bound server-owned", async () => {
  const previousOperatorTokens = config.adminOperatorTokens;
  const originalRetries = adminService.listGenerationRetryQueue;
  const requestedLimits: number[] = [];

  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  adminService.listGenerationRetryQueue = async (limit = 25) => {
    requestedLimits.push(limit);
    return [];
  };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const denied = await GET(new Request("https://timelines.example/api/admin/factory/v2/generation-retries?limit=1000"), {});
    assert.equal(denied.status, 401);
    assert.deepEqual(requestedLimits, []);

    const response = await GET(
      new Request("https://timelines.example/api/admin/factory/v2/generation-retries?limit=1000", {
        headers: { authorization: "Bearer factory-secret" }
      }),
      {}
    );
    const payload = await response.json() as { ok: boolean; data?: unknown };

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.data, []);
    assert.deepEqual(requestedLimits, [100]);
  } finally {
    config.adminOperatorTokens = previousOperatorTokens;
    adminService.listGenerationRetryQueue = originalRetries;
    setAdminSecurityAuditStoreForTests(null);
  }
});
