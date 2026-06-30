import { fail, ok } from "@/src/server/api/responses";
import { isAuthorizedCronRequest } from "@/src/server/api/cron-auth";
import { scheduledOperationsService } from "@/src/server/services/scheduled-operations-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return fail(401, "Maintenance scheduler authentication failed.");
  const result = await scheduledOperationsService.runDue();
  return ok(result, { headers: { "Cache-Control": "no-store" } });
}
