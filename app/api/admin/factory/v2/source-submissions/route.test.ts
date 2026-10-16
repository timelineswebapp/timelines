import assert from "node:assert/strict";
import test from "node:test";
import { config } from "@/src/lib/config";
import { adminService } from "@/src/server/services/admin-service";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";
import { GET, POST } from "./route";
import { GET as inspectionGET } from "./[candidateId]/route";

test("submitted-source visibility is authenticated, bounded, and rejects duplicate limits", async () => {
  const previousOperatorTokens = config.adminOperatorTokens;
  const originalList = adminService.listFactoryV2SourceSubmissions;
  const requestedLimits: number[] = [];

  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  adminService.listFactoryV2SourceSubmissions = async (limit = 25) => {
    requestedLimits.push(limit);
    return [];
  };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const denied = await GET(new Request("https://timelines.example/api/admin/factory/v2/source-submissions?limit=1000"), {});
    assert.equal(denied.status, 401);
    assert.deepEqual(requestedLimits, []);

    const duplicate = await GET(
      new Request("https://timelines.example/api/admin/factory/v2/source-submissions?limit=1&limit=100", {
        headers: { authorization: "Bearer factory-secret" }
      }),
      {}
    );
    assert.equal(duplicate.status, 400);
    assert.deepEqual(requestedLimits, []);

    const response = await GET(
      new Request("https://timelines.example/api/admin/factory/v2/source-submissions?limit=1000", {
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
    adminService.listFactoryV2SourceSubmissions = originalList;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("submitted-source creation rejects unsafe input and derives operator lineage on success", async () => {
  const previousOperatorTokens = config.adminOperatorTokens;
  const originalCreate = adminService.createFactoryV2SourceSubmission;
  const submitted: unknown[] = [];

  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  adminService.createFactoryV2SourceSubmission = async (input) => {
    submitted.push(input);
    return { state: "CREATED", candidateId: "candidate-1" };
  };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const unsafe = await POST(
      new Request("https://timelines.example/api/admin/factory/v2/source-submissions", {
        method: "POST",
        headers: { authorization: "Bearer factory-secret", "content-type": "application/json" },
        body: JSON.stringify({ operationId: "operation-1", submittedUrl: "https://operator:secret@example.org/record", rationale: "A sufficiently detailed provenance rationale." })
      }),
      {}
    );
    assert.equal(unsafe.status, 400);
    assert.deepEqual(submitted, []);

    const response = await POST(
      new Request("https://timelines.example/api/admin/factory/v2/source-submissions", {
        method: "POST",
        headers: { authorization: "Bearer factory-secret", "content-type": "application/json" },
        body: JSON.stringify({ operationId: "operation-1", submittedUrl: "https://example.org/record", rationale: "A sufficiently detailed provenance rationale." })
      }),
      {}
    );
    const payload = await response.json() as { ok: boolean; data?: unknown };

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.data, { state: "CREATED", candidateId: "candidate-1" });
    assert.deepEqual(submitted, [{
      operationId: "operation-1",
      submittedUrl: "https://example.org/record",
      rationale: "A sufficiently detailed provenance rationale.",
      submittedBy: "operator-1"
    }]);
  } finally {
    config.adminOperatorTokens = previousOperatorTokens;
    adminService.createFactoryV2SourceSubmission = originalCreate;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("submitted-source inspection requires a Factory operator and canonical candidate identity", async () => {
  const previousOperatorTokens = config.adminOperatorTokens;
  const originalInspection = adminService.getFactoryV2SourceSubmissionInspection;
  const inspected: string[] = [];

  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  adminService.getFactoryV2SourceSubmissionInspection = async (candidateId) => {
    inspected.push(candidateId);
    return { candidateId, state: "CANDIDATE", submittedAt: "2026-10-16T03:01:00.000Z", validation: null, retrieval: null, qualifyingEvidence: false, reentryAuthorized: false };
  };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  try {
    const denied = await inspectionGET(new Request("https://timelines.example/api/admin/factory/v2/source-submissions/candidate-001"), { params: Promise.resolve({ candidateId: "candidate-001" }) });
    assert.equal(denied.status, 401);
    assert.deepEqual(inspected, []);

    const malformed = await inspectionGET(new Request("https://timelines.example/api/admin/factory/v2/source-submissions/candidate%20id", { headers: { authorization: "Bearer factory-secret" } }), { params: Promise.resolve({ candidateId: "candidate id" }) });
    assert.equal(malformed.status, 400);
    assert.deepEqual(inspected, []);

    const response = await inspectionGET(new Request("https://timelines.example/api/admin/factory/v2/source-submissions/candidate-001", { headers: { authorization: "Bearer factory-secret" } }), { params: Promise.resolve({ candidateId: "candidate-001" }) });
    const payload = await response.json() as { ok: boolean; data?: unknown };
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.deepEqual(inspected, ["candidate-001"]);
    assert.deepEqual(payload.data, { candidateId: "candidate-001", state: "CANDIDATE", submittedAt: "2026-10-16T03:01:00.000Z", validation: null, retrieval: null, qualifyingEvidence: false, reentryAuthorized: false });
  } finally {
    config.adminOperatorTokens = previousOperatorTokens;
    adminService.getFactoryV2SourceSubmissionInspection = originalInspection;
    setAdminSecurityAuditStoreForTests(null);
  }
});
