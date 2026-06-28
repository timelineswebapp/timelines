import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryOperationsMutationSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const PATCH = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok(await adminService.mutateFactoryOperationsTopic({
    topicId: uuidParamSchema.parse(id),
    ...factoryOperationsMutationSchema.parse(await request.json())
  }));
}, { roles: ["factory_operator"] });
