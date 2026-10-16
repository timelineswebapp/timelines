import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryRevisionPlanSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }, identity) => {
  const { id: rawId } = await params;
  const feedbackConsumptionId = uuidParamSchema.parse(rawId);
  const input = factoryRevisionPlanSchema.parse(await request.json());
  return ok(await adminService.createFactoryRevisionPlan({ ...input, feedbackConsumptionId, actor: identity.operatorId }), { status: 201 });
}, { roles: ["factory_operator"] });
