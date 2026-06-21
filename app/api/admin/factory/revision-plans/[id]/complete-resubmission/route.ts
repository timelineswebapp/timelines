import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryResubmissionCompletionSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const revisionPlanId = uuidParamSchema.parse(rawId);
  const input = factoryResubmissionCompletionSchema.parse(await request.json());
  return ok(await adminService.completeFactoryResubmission({ ...input, revisionPlanId }), { status: 201 });
});
