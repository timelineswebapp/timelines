import { fail, ok } from "@/src/server/api/responses";
import { isAuthorizedCronRequest } from "@/src/server/api/cron-auth";
import { governanceExecutionService } from "@/src/server/services/governance-execution-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return fail(401, "Governance scheduler authentication failed.");
  const result = await governanceExecutionService.runCycle();
  return ok(result, { headers: { "Cache-Control": "no-store" } });
}
