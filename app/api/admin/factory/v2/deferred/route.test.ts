import assert from "node:assert/strict";
import test from "node:test";
import { config } from "@/src/lib/config";
import { adminService } from "@/src/server/services/admin-service";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";
import { GET } from "./route";

test("deferred-topic visibility requires a factory operator and rejects duplicate limits", async () => {
  const previousOperatorTokens = config.adminOperatorTokens;
  const originalList = adminService.listDeferredFactoryV2Topics;
  const requestedLimits: number[] = [];
  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  adminService.listDeferredFactoryV2Topics = async (limit = 25) => {
    requestedLimits.push(limit);
    return [];
  };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const denied = await GET(new Request("https://timelines.example/api/admin/factory/v2/deferred?limit=100"), {});
    assert.equal(denied.status, 401);
    const duplicate = await GET(new Request("https://timelines.example/api/admin/factory/v2/deferred?limit=1&limit=100", { headers: { authorization: "Bearer factory-secret" } }), {});
    assert.equal(duplicate.status, 400);
    assert.deepEqual(requestedLimits, []);
    const response = await GET(new Request("https://timelines.example/api/admin/factory/v2/deferred?limit=1000", { headers: { authorization: "Bearer factory-secret" } }), {});
    assert.equal(response.status, 200);
    assert.deepEqual(requestedLimits, [100]);
  } finally {
    config.adminOperatorTokens = previousOperatorTokens;
    adminService.listDeferredFactoryV2Topics = originalList;
    setAdminSecurityAuditStoreForTests(null);
  }
});
