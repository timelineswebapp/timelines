import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryGovernanceHandoffSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async (request: Request) => {
  const status = new URL(request.url).searchParams.get("status") || undefined;
  return ok(await adminService.listFactoryGovernanceSubmissions(status as never));
});

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryGovernanceHandoffSchema.parse(await request.json());
  return ok(await adminService.prepareFactoryGovernanceHandoff(input), { status: 201 });
});
