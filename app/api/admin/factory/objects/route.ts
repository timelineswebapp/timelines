import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryObjectSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryObjectSchema.parse(await request.json());
  return ok(await adminService.createFactoryObject(input), { status: 201 });
}, { roles: ["factory_operator"] });
