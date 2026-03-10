import { fail, ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { requestStatusUpdateSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async () => ok(await adminService.listRequests()));

export const PATCH = withAdminAuth(async (request: Request) => {
  const body = await request.json();
  const input = requestStatusUpdateSchema.parse(body);
  const updated = await adminService.updateRequestStatus(input.id, input.status);
  if (!updated) {
    return fail(404, "Timeline request not found.");
  }
  return ok(updated);
});
