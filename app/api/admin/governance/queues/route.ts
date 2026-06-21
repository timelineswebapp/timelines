import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { governanceQueueSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request) => {
  const body = await request.json();
  const input = governanceQueueSchema.parse(body);
  return ok(await adminService.createGovernanceQueue(input), { status: 201 });
});
