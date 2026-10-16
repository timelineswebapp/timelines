import assert from "node:assert/strict";
import test from "node:test";
import { config } from "@/src/lib/config";
import { adminService } from "@/src/server/services/admin-service";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";
import { POST as registerWorker } from "./workers/route";
import { POST as registerPrompt } from "./prompts/route";
import { POST as queueJob } from "./jobs/route";
import { POST as transitionJob } from "./jobs/[id]/transition/route";
import { POST as executeJob } from "./jobs/[id]/execute/route";
import { POST as syncRegistry } from "./worker-registry/route";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const WORKER_ID = "22222222-2222-4222-8222-222222222222";
const PROMPT_ID = "33333333-3333-4333-8333-333333333333";

function request(path: string, body: unknown): Request {
  return new Request(`https://timelines.example${path}`, {
    method: "POST",
    headers: { authorization: "Bearer factory-secret", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("Factory runtime write routes derive audit attribution from the authenticated operator", async () => {
  const previousTokens = config.adminOperatorTokens;
  const originalWorker = adminService.registerFactoryRuntimeWorker;
  const originalPrompt = adminService.registerFactoryRuntimePrompt;
  const originalJob = adminService.queueFactoryRuntimeJob;
  const originalTransition = adminService.transitionFactoryRuntimeJob;
  const originalExecute = adminService.executeFactoryRuntimeJob;
  const originalSync = adminService.syncFactoryWorkerRegistry;
  const received: unknown[] = [];
  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  setAdminSecurityAuditStoreForTests({ async append() {} });
  adminService.registerFactoryRuntimeWorker = async (input) => { received.push({ operation: "worker", input }); return {} as Awaited<ReturnType<typeof originalWorker>>; };
  adminService.registerFactoryRuntimePrompt = async (input) => { received.push({ operation: "prompt", input }); return {} as Awaited<ReturnType<typeof originalPrompt>>; };
  adminService.queueFactoryRuntimeJob = async (input) => { received.push({ operation: "job", input }); return {} as Awaited<ReturnType<typeof originalJob>>; };
  adminService.transitionFactoryRuntimeJob = async (input) => { received.push({ operation: "transition", input }); return {} as Awaited<ReturnType<typeof originalTransition>>; };
  adminService.executeFactoryRuntimeJob = async (input) => { received.push({ operation: "execute", input }); return {} as Awaited<ReturnType<typeof originalExecute>>; };
  adminService.syncFactoryWorkerRegistry = async (input) => { received.push({ operation: "sync", input }); return {} as Awaited<ReturnType<typeof originalSync>>; };

  try {
    assert.equal((await registerWorker(request("/api/admin/factory/runtime/workers", { workerKey: "worker-1", displayName: "Worker One", description: "A verified test worker.", actor: "forged-browser-user", reason: "Register test worker." }), {})).status, 201);
    assert.equal((await registerPrompt(request("/api/admin/factory/runtime/prompts", { promptKey: "prompt-1", title: "Prompt One", template: "A verified test prompt template.", actor: "forged-browser-user", reason: "Register test prompt." }), {})).status, 201);
    assert.equal((await queueJob(request("/api/admin/factory/runtime/jobs", { workerId: WORKER_ID, promptId: PROMPT_ID, input: { subject: "test" }, actor: "forged-browser-user", reason: "Queue test job." }), {})).status, 201);
    assert.equal((await transitionJob(request(`/api/admin/factory/runtime/jobs/${JOB_ID}/transition`, { status: "cancelled", actor: "forged-browser-user", reason: "Cancel test job." }), { params: Promise.resolve({ id: JOB_ID }) })).status, 200);
    assert.equal((await executeJob(request(`/api/admin/factory/runtime/jobs/${JOB_ID}/execute`, { actor: "forged-browser-user", reason: "Execute test job." }), { params: Promise.resolve({ id: JOB_ID }) })).status, 200);
    assert.equal((await syncRegistry(request("/api/admin/factory/runtime/worker-registry", { actor: "forged-browser-user", reason: "Synchronize workers." }), {})).status, 201);

    assert.deepEqual(received, [
      { operation: "worker", input: { workerKey: "worker-1", displayName: "Worker One", description: "A verified test worker.", capabilities: [], defaultProviderKey: "qwen14", actor: "operator-1", reason: "Register test worker." } },
      { operation: "prompt", input: { promptKey: "prompt-1", title: "Prompt One", template: "A verified test prompt template.", inputSchema: {}, outputSchema: {}, actor: "operator-1", reason: "Register test prompt." } },
      { operation: "job", input: { workerId: WORKER_ID, promptId: PROMPT_ID, priority: 0, input: { subject: "test" }, configuration: {}, actor: "operator-1", reason: "Queue test job." } },
      { operation: "transition", input: { jobId: JOB_ID, status: "cancelled", actor: "operator-1", reason: "Cancel test job." } },
      { operation: "execute", input: { jobId: JOB_ID, actor: "operator-1", reason: "Execute test job." } },
      { operation: "sync", input: { actor: "operator-1", reason: "Synchronize workers." } }
    ]);
  } finally {
    config.adminOperatorTokens = previousTokens;
    adminService.registerFactoryRuntimeWorker = originalWorker;
    adminService.registerFactoryRuntimePrompt = originalPrompt;
    adminService.queueFactoryRuntimeJob = originalJob;
    adminService.transitionFactoryRuntimeJob = originalTransition;
    adminService.executeFactoryRuntimeJob = originalExecute;
    adminService.syncFactoryWorkerRegistry = originalSync;
    setAdminSecurityAuditStoreForTests(null);
  }
});

test("Factory runtime job actions reject malformed path identities before reaching services", async () => {
  const previousTokens = config.adminOperatorTokens;
  const originalTransition = adminService.transitionFactoryRuntimeJob;
  const originalExecute = adminService.executeFactoryRuntimeJob;
  config.adminOperatorTokens = "operator-1|factory_operator|factory-secret|Factory Operator|true";
  setAdminSecurityAuditStoreForTests({ async append() {} });
  adminService.transitionFactoryRuntimeJob = async () => { throw new Error("service must not be called"); };
  adminService.executeFactoryRuntimeJob = async () => { throw new Error("service must not be called"); };
  try {
    assert.equal((await transitionJob(request("/api/admin/factory/runtime/jobs/not-a-uuid/transition", { status: "cancelled", reason: "Cancel test job." }), { params: Promise.resolve({ id: "not-a-uuid" }) })).status, 400);
    assert.equal((await executeJob(request("/api/admin/factory/runtime/jobs/not-a-uuid/execute", { reason: "Execute test job." }), { params: Promise.resolve({ id: "not-a-uuid" }) })).status, 400);
  } finally {
    config.adminOperatorTokens = previousTokens;
    adminService.transitionFactoryRuntimeJob = originalTransition;
    adminService.executeFactoryRuntimeJob = originalExecute;
    setAdminSecurityAuditStoreForTests(null);
  }
});
