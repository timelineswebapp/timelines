import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryPipelineCancellationSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const params = await context.params;
  const input = factoryPipelineCancellationSchema.parse(await request.json());
  return ok(await adminService.cancelFactoryPipeline({ ...input, pipelineRunId: params.id }));
}, { roles: ["factory_operator"] });
