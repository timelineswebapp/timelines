import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { founderInboxActionSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, _context, identity) => {
  const command = founderInboxActionSchema.parse(await request.json());
  return ok(await adminService.actOnFounderInbox({ ...command, actor: identity.operatorId }));
}, {
  roles: ["admin"]
});
