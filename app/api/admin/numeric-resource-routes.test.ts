import assert from "node:assert/strict";
import test from "node:test";
import { config } from "@/src/lib/config";
import { adminService } from "@/src/server/services/admin-service";
import { setAdminSecurityAuditStoreForTests } from "@/src/server/security/admin-identity";
import { DELETE as deleteCampaign } from "./ads/[id]/route";
import { DELETE as deleteEvent } from "./events/[id]/route";
import { DELETE as deleteTag } from "./tags/[id]/route";
import { DELETE as deleteTimeline } from "./timelines/[id]/route";

test("mutable numeric Admin resources reject noncanonical path identities before service calls", async () => {
  const previousToken = config.adminApiToken;
  const originalCampaign = adminService.deleteAdCampaign;
  const originalEvent = adminService.deleteEvent;
  const originalTag = adminService.deleteTag;
  const originalTimeline = adminService.deleteTimeline;
  const calls: string[] = [];
  config.adminApiToken = "admin-secret";
  adminService.deleteAdCampaign = async () => { calls.push("campaign"); return false; };
  adminService.deleteEvent = async () => { calls.push("event"); return false; };
  adminService.deleteTag = async () => { calls.push("tag"); return false; };
  adminService.deleteTimeline = async () => { calls.push("timeline"); return false; };
  setAdminSecurityAuditStoreForTests({ async append() {} });

  const request = new Request("https://timelines.example/api/admin/resource/1e2", { method: "DELETE", headers: { authorization: "Bearer admin-secret" } });
  try {
    for (const remove of [deleteCampaign, deleteEvent, deleteTag, deleteTimeline]) {
      const response = await remove(request, { params: Promise.resolve({ id: "1e2" }) });
      assert.equal(response.status, 400);
    }
    assert.deepEqual(calls, []);
  } finally {
    config.adminApiToken = previousToken;
    adminService.deleteAdCampaign = originalCampaign;
    adminService.deleteEvent = originalEvent;
    adminService.deleteTag = originalTag;
    adminService.deleteTimeline = originalTimeline;
    setAdminSecurityAuditStoreForTests(null);
  }
});
