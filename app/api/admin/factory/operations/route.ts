import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryOperationsTopicSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async () => ok(await adminService.getFactoryOperationsSnapshot()), { roles: ["factory_operator"] });
export const POST = withAdminAuth(async (request: Request, _context, identity) => {
  const command = factoryOperationsTopicSchema.parse(await request.json());
  return ok(await adminService.addFactoryOperationsTopic({ ...command, actor: identity.operatorId }), { status: 201 });
},
{ roles: ["factory_operator"] });
