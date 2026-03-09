import { fail, fromError, ok } from "@/src/server/api/responses";
import { isAdminAuthorized } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { requestStatusUpdateSchema } from "@/src/server/validation/schemas";

export async function GET(request: Request) {
  try {
    if (!isAdminAuthorized(request)) {
      return fail(401, "Unauthorized.");
    }
    return ok(await adminService.listRequests());
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isAdminAuthorized(request)) {
      return fail(401, "Unauthorized.");
    }
    const body = await request.json();
    const input = requestStatusUpdateSchema.parse(body);
    const updated = await adminService.updateRequestStatus(input.id, input.status);
    if (!updated) {
      return fail(404, "Timeline request not found.");
    }
    return ok(updated);
  } catch (error) {
    return fromError(error);
  }
}
