import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryPackageDraftSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, _context, identity) => {
  const input = factoryPackageDraftSchema.parse(await request.json());
  return ok(await adminService.createFactoryPackageDraft({ ...input, actor: identity.operatorId }), { status: 201 });
}, { roles: ["factory_operator"] });
