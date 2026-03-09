export const dynamic = "force-dynamic";

import { fail, fromError, ok } from "@/src/server/api/responses";
import { isAdminAuthorized } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

export async function GET(request: Request) {
  try {
    if (!isAdminAuthorized(request)) {
      return fail(401, "Unauthorized.");
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("mode") === "snapshot") {
      return ok(await adminService.getAnalyticsSnapshot());
    }

    return ok(await adminService.getDashboardOverview());
  } catch (error) {
    return fromError(error);
  }
}
