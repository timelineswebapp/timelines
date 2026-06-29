import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { founderInboxActionSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request) =>
  ok(await adminService.actOnFounderInbox(founderInboxActionSchema.parse(await request.json()))), {
  roles: ["admin"]
});
