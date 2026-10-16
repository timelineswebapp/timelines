import assert from "node:assert/strict";
import test from "node:test";
import { config } from "@/src/lib/config";
import { adminService } from "@/src/server/services/admin-service";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";
import { GET } from "./route";

test("retry-health is factory-operator protected and returns only the aggregate health contract", async () => {
  const previousOperatorTokens = config.adminOperatorTokens;
  const originalHealth = adminService.getGenerationRetryQueueHealth;
  let called = false;

  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  adminService.getGenerationRetryQueueHealth = async () => {
    called = true;
    return { scheduledCount: 3, dueCount: 1, oldestDueAt: "2026-10-16T08:00:00.000Z" };
  };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const denied = await GET(new Request("https://timelines.example/api/admin/factory/v2/generation-retry-health"), {});
    assert.equal(denied.status, 401);
    assert.equal(called, false);

    const response = await GET(
      new Request("https://timelines.example/api/admin/factory/v2/generation-retry-health", {
        headers: { authorization: "Bearer factory-secret" }
      }),
      {}
    );
    const payload = await response.json() as { ok: boolean; data?: Record<string, unknown> };

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.data, {
      scheduledCount: 3,
      dueCount: 1,
      oldestDueAt: "2026-10-16T08:00:00.000Z"
    });
    assert.equal(called, true);
  } finally {
    config.adminOperatorTokens = previousOperatorTokens;
    adminService.getGenerationRetryQueueHealth = originalHealth;
    setAdminSecurityAuditStoreForTests(null);
  }
});
