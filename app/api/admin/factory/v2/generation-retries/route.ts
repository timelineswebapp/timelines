import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

/** Read-only queue visibility. Retry dispatch remains exclusively scheduler-owned. */
export const GET = withAdminAuth(async (request: Request) => {
  const parsedLimit = Number(new URL(request.url).searchParams.get("limit") || "25");
  const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 25;
  return ok(await adminService.listGenerationRetryQueue(limit));
}, { roles: ["factory_operator"] });
