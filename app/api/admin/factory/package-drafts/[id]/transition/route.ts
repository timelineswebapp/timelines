import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryPackageDraftTransitionSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const packageDraftId = uuidParamSchema.parse(rawId);
  const input = factoryPackageDraftTransitionSchema.parse(await request.json());
  return ok(await adminService.transitionFactoryPackageDraft({ ...input, packageDraftId }));
}, { roles: ["factory_operator"] });
