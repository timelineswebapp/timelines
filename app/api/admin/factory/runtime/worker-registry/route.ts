import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryWorkerRegistrySyncSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async () => ok(await adminService.listFactoryWorkerRegistry()));

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryWorkerRegistrySyncSchema.parse(await request.json());
  return ok(await adminService.syncFactoryWorkerRegistry(input), { status: 201 });
});
