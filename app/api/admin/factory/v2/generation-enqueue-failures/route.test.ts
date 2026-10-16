import assert from "node:assert/strict";
import test from "node:test";
import { config } from "@/src/lib/config";
import { adminService } from "@/src/server/services/admin-service";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";
import { GET } from "./route";

test("terminal enqueue failures require a factory operator and normalize the bounded list limit", async () => {
  const previousOperatorTokens = config.adminOperatorTokens;
  const originalFailures = adminService.listGenerationEnqueueFailures;
  const requestedLimits: number[] = [];

  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  adminService.listGenerationEnqueueFailures = async (limit = 25) => {
    requestedLimits.push(limit);
    return [];
  };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const denied = await GET(new Request("https://timelines.example/api/admin/factory/v2/generation-enqueue-failures?limit=1000"), {});
    assert.equal(denied.status, 401);
    assert.deepEqual(requestedLimits, []);

    for (const [rawLimit, expectedLimit] of [["1000", 100], ["0", 1], ["not-a-number", 25], ["1e2", 25]] as const) {
      const response = await GET(
        new Request(`https://timelines.example/api/admin/factory/v2/generation-enqueue-failures?limit=${rawLimit}`, {
          headers: { authorization: "Bearer factory-secret" }
        }),
        {}
      );
      const payload = await response.json() as { ok: boolean; data?: unknown };

      assert.equal(response.status, 200);
      assert.equal(payload.ok, true);
      assert.deepEqual(payload.data, []);
      assert.equal(requestedLimits.at(-1), expectedLimit);
    }
  } finally {
    config.adminOperatorTokens = previousOperatorTokens;
    adminService.listGenerationEnqueueFailures = originalFailures;
    setAdminSecurityAuditStoreForTests(null);
  }
});
