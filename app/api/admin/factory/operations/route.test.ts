import assert from "node:assert/strict";
import test from "node:test";
import { config } from "@/src/lib/config";
import { adminService } from "@/src/server/services/admin-service";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";
import { POST as addTopic } from "./route";
import { POST as controlFactory } from "./control/route";
import { PATCH as mutateTopic } from "./topics/[id]/route";
import { PATCH as transitionAlert } from "../../operations/alerts/[id]/route";
import { POST as actOnInbox } from "../../founder/inbox/route";
import { POST as approveVisitorRequest } from "../../founder/visitor-requests/approve/route";

const TOPIC_ID = "11111111-1111-4111-8111-111111111111";
const ALERT_ID = "22222222-2222-4222-8222-222222222222";
const NOTIFICATION_ID = "33333333-3333-4333-8333-333333333333";

function operatorRequest(path: string, body: unknown, method = "POST"): Request {
  return new Request(`https://timelines.example${path}`, {
    method,
    headers: { authorization: "Bearer operator-secret", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("Founder operational mutations persist the authenticated operator, never browser-supplied attribution", async () => {
  const previousTokens = config.adminOperatorTokens;
  const originalAddTopic = adminService.addFactoryOperationsTopic;
  const originalControl = adminService.controlFactoryOperations;
  const originalMutate = adminService.mutateFactoryOperationsTopic;
  const originalAlert = adminService.transitionOperationalAlert;
  const originalInbox = adminService.actOnFounderInbox;
  const originalApproveVisitor = adminService.approveFounderVisitorRequest;
  const received: unknown[] = [];

  config.adminOperatorTokens = "operator-1|factory_operator,admin|operator-secret|Factory Operator|true";
  setAdminSecurityAuditStoreForTests({ async append() {} });
  adminService.addFactoryOperationsTopic = async (input) => { received.push({ operation: "add-topic", input }); return {} as Awaited<ReturnType<typeof originalAddTopic>>; };
  adminService.controlFactoryOperations = async (input) => { received.push({ operation: "control", input }); return {} as Awaited<ReturnType<typeof originalControl>>; };
  adminService.mutateFactoryOperationsTopic = async (input) => { received.push({ operation: "mutate-topic", input }); return {} as Awaited<ReturnType<typeof originalMutate>>; };
  adminService.transitionOperationalAlert = async (alertId, action, actor) => { received.push({ operation: "alert", alertId, action, actor }); return {} as Awaited<ReturnType<typeof originalAlert>>; };
  adminService.actOnFounderInbox = async (input) => { received.push({ operation: "inbox", input }); return {} as Awaited<ReturnType<typeof originalInbox>>; };
  adminService.approveFounderVisitorRequest = async (requestId, actor) => { received.push({ operation: "visitor", requestId, actor }); return {} as Awaited<ReturnType<typeof originalApproveVisitor>>; };

  try {
    assert.equal((await controlFactory(operatorRequest("/api/admin/factory/operations/control", { action: "start", actor: "forged-browser-user" }), {})).status, 200);
    assert.equal((await addTopic(operatorRequest("/api/admin/factory/operations", { title: "Verified operational topic", source: "founder", actor: "forged-browser-user" }), {})).status, 201);
    assert.equal((await mutateTopic(operatorRequest(`/api/admin/factory/operations/topics/${TOPIC_ID}`, { action: "retry", actor: "forged-browser-user" }, "PATCH"), { params: Promise.resolve({ id: TOPIC_ID }) })).status, 200);
    assert.equal((await transitionAlert(operatorRequest(`/api/admin/operations/alerts/${ALERT_ID}`, { action: "acknowledge", actor: "forged-browser-user" }, "PATCH"), { params: Promise.resolve({ id: ALERT_ID }) })).status, 200);
    assert.equal((await actOnInbox(operatorRequest("/api/admin/founder/inbox", { notificationId: NOTIFICATION_ID, topicId: TOPIC_ID, action: "approve", actor: "forged-browser-user" }), {})).status, 200);
    assert.equal((await approveVisitorRequest(operatorRequest("/api/admin/founder/visitor-requests/approve", { requestId: 42, actor: "forged-browser-user" }), {})).status, 200);

    assert.deepEqual(received, [
      { operation: "control", input: { action: "start", actor: "operator-1" } },
      { operation: "add-topic", input: { title: "Verified operational topic", source: "founder", sourceReference: null, priority: 100, maxRetries: 3, actor: "operator-1" } },
      { operation: "mutate-topic", input: { topicId: TOPIC_ID, action: "retry", actor: "operator-1" } },
      { operation: "alert", alertId: ALERT_ID, action: "acknowledge", actor: "operator-1" },
      { operation: "inbox", input: { notificationId: NOTIFICATION_ID, topicId: TOPIC_ID, action: "approve", actor: "operator-1" } },
      { operation: "visitor", requestId: 42, actor: "operator-1" }
    ]);
  } finally {
    config.adminOperatorTokens = previousTokens;
    adminService.addFactoryOperationsTopic = originalAddTopic;
    adminService.controlFactoryOperations = originalControl;
    adminService.mutateFactoryOperationsTopic = originalMutate;
    adminService.transitionOperationalAlert = originalAlert;
    adminService.actOnFounderInbox = originalInbox;
    adminService.approveFounderVisitorRequest = originalApproveVisitor;
    setAdminSecurityAuditStoreForTests(null);
  }
});
