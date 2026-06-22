import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryRuntimeJobExecutionSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  const input = factoryRuntimeJobExecutionSchema.parse(await request.json());
  return ok(await adminService.executeFactoryRuntimeJob({ ...input, jobId: context.params.id }));
});
