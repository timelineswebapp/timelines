import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

export const GET = withAdminAuth(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const params = await context.params;
  return ok(await adminService.getFactoryGovernanceHandoffStatus(params.id));
}, { roles: ["factory_operator"] });
