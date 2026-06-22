import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryRuntimeWorkerSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async () => ok(await adminService.listFactoryRuntimeWorkers()));

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryRuntimeWorkerSchema.parse(await request.json());
  return ok(await adminService.registerFactoryRuntimeWorker(input), { status: 201 });
});
