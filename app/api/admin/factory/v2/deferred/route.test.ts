import assert from "node:assert/strict";
import test from "node:test";
import { config } from "@/src/lib/config";
import { adminService } from "@/src/server/services/admin-service";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";
import { GET } from "./route";
import { POST as createDeferredReentry } from "../deferred-reentry/route";

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

test("deferred re-entry creation requires a factory operator and trigger-compatible inputs", async () => {
  const previousOperatorTokens = config.adminOperatorTokens;
  const originalCreate = adminService.createDeferredFactoryV2Reentry;
  const received: unknown[] = [];
  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  adminService.createDeferredFactoryV2Reentry = async (input) => {
    received.push(input);
    return { state: "CREATED", requestId: "request-1" };
  };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  const request = (body: unknown, authorized = true) => new Request("https://timelines.example/api/admin/factory/v2/deferred-reentry", {
    method: "POST",
    headers: { "content-type": "application/json", ...(authorized ? { authorization: "Bearer factory-secret" } : {}) },
    body: JSON.stringify(body)
  });

  try {
    const denied = await createDeferredReentry(request({ operationId: "operation-1", trigger: "AUTHORIZED_RETRY", authorizationReason: "Recorded authorization." }, false), {});
    assert.equal(denied.status, 401);
    const mismatched = await createDeferredReentry(request({ operationId: "operation-1", trigger: "RELEVANT_EVIDENCE_CHANGE", authorizationReason: "Not applicable." }), {});
    assert.equal(mismatched.status, 400);
    assert.deepEqual(received, []);
    const response = await createDeferredReentry(request({ operationId: "operation-1", trigger: "AUTHORIZED_RETRY", authorizationReason: "Recorded authorization." }), {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, data: { state: "CREATED", requestId: "request-1" } });
    const evidenceChange = await createDeferredReentry(request({ operationId: "operation-2", trigger: "RELEVANT_EVIDENCE_CHANGE", relevantChangeArtifactId: "snapshot-1" }), {});
    assert.equal(evidenceChange.status, 200);
    assert.deepEqual(received, [
      { operationId: "operation-1", trigger: "AUTHORIZED_RETRY", relevantChangeArtifactId: null, authorizedBy: "operator-1", authorizationReason: "Recorded authorization." },
      { operationId: "operation-2", trigger: "RELEVANT_EVIDENCE_CHANGE", relevantChangeArtifactId: "snapshot-1", authorizedBy: null, authorizationReason: null }
    ]);
  } finally {
    config.adminOperatorTokens = previousOperatorTokens;
    adminService.createDeferredFactoryV2Reentry = originalCreate;
    setAdminSecurityAuditStoreForTests(null);
  }
});
