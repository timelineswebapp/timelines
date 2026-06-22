import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

export const GET = withAdminAuth(async (request: Request) => {
  const jobId = new URL(request.url).searchParams.get("jobId") || undefined;
  return ok(await adminService.listFactoryRuntimeExecutions(jobId));
});
