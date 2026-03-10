export const dynamic = "force-dynamic";

import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

export const GET = withAdminAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("mode") === "snapshot") {
    return ok(await adminService.getAnalyticsSnapshot());
  }

  return ok(await adminService.getDashboardOverview());
});
