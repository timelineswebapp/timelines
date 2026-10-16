import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryOperationsControlSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, _context, identity) => {
  const command = factoryOperationsControlSchema.parse(await request.json());
  return ok(await adminService.controlFactoryOperations({ ...command, actor: identity.operatorId }));
},
{ roles: ["factory_operator"] });
