import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryRuntimeJobTransitionSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, context: { params: Promise<{ id: string }> }, identity) => {
  const params = await context.params;
  const input = factoryRuntimeJobTransitionSchema.parse(await request.json());
  return ok(await adminService.transitionFactoryRuntimeJob({ ...input, jobId: uuidParamSchema.parse(params.id), actor: identity.operatorId }));
}, { roles: ["factory_operator"] });
