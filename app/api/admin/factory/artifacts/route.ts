import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryArtifactSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryArtifactSchema.parse(await request.json());
  return ok(await adminService.createFactoryArtifact(input), { status: 201 });
});
