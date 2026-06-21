import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryObjectTransitionSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const objectId = uuidParamSchema.parse(rawId);
  const input = factoryObjectTransitionSchema.parse(await request.json());
  return ok(await adminService.transitionFactoryObject({ ...input, objectId }));
});
