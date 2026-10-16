import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { parseOptionalEnumQueryParameter } from "@/src/server/api/query-params";
import { adminService } from "@/src/server/services/admin-service";
import { factoryPipelineStartSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async (request: Request) => {
  const status = parseOptionalEnumQueryParameter(new URL(request.url).searchParams, "status", ["queued", "running", "completed", "failed", "cancelled"] as const);
  return ok(await adminService.listFactoryPipelineRuns(status));
}, { roles: ["factory_operator"] });

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryPipelineStartSchema.parse(await request.json());
  return ok(await adminService.startFactoryPipeline(input), { status: 201 });
}, { roles: ["factory_operator"] });
