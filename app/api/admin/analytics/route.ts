export const dynamic = "force-dynamic";

import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { parseOptionalEnumQueryParameter } from "@/src/server/api/query-params";
import { adminService } from "@/src/server/services/admin-service";

export const GET = withAdminAuth(async (request: Request) => {
  const mode = parseOptionalEnumQueryParameter(new URL(request.url).searchParams, "mode", ["snapshot", "report"] as const);
  if (mode === "snapshot") {
    return ok(await adminService.getAnalyticsSnapshot());
  }
  if (mode === "report") {
    return ok(await adminService.getAnalyticsReport());
  }

  return ok(await adminService.getDashboardOverview());
}, { roles: ["admin"] });
