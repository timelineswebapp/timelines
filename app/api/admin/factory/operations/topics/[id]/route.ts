import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryOperationsMutationSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok(await adminService.getFactoryTopicDetail(uuidParamSchema.parse(id)));
}, { roles: ["factory_operator"] });

export const PATCH = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }, identity) => {
  const { id } = await params;
  const command = factoryOperationsMutationSchema.parse(await request.json());
  return ok(await adminService.mutateFactoryOperationsTopic({
    topicId: uuidParamSchema.parse(id),
    ...command,
    actor: identity.operatorId
  }));
}, { roles: ["factory_operator"] });
