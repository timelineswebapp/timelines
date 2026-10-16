import { ok } from "@/src/server/api/responses";
import { parseBoundedAdminListLimit } from "@/src/server/api/query-params";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

/** Read-only queue visibility. Retry dispatch remains exclusively scheduler-owned. */
export const GET = withAdminAuth(async (request: Request) => {
  const limit = parseBoundedAdminListLimit(new URL(request.url).searchParams);
  return ok(await adminService.listGenerationRetryQueue(limit));
}, { roles: ["factory_operator"] });
