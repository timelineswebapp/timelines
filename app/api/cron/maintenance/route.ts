import { fail, ok } from "@/src/server/api/responses";
import { authenticateCronRequest } from "@/src/server/api/cron-auth";
import { scheduledOperationsService } from "@/src/server/services/scheduled-operations-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authentication = authenticateCronRequest(request);
  if (!authentication.authorized) {
    return fail(401, "Maintenance scheduler authentication failed.", authentication.diagnostics);
  }
  const result = await scheduledOperationsService.runDue();
  return ok(result, { headers: { "Cache-Control": "no-store" } });
}
