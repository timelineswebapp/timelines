import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryRuntimeJobSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async (request: Request) => {
  const status = new URL(request.url).searchParams.get("status") || undefined;
  return ok(await adminService.listFactoryRuntimeJobs(status as never));
}, { roles: ["factory_operator"] });

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryRuntimeJobSchema.parse(await request.json());
  return ok(await adminService.queueFactoryRuntimeJob(input), { status: 201 });
}, { roles: ["factory_operator"] });
