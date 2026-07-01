import { fail, ok } from "@/src/server/api/responses";
import { authenticateCronRequest } from "@/src/server/api/cron-auth";
import { FactoryDispatcher } from "@/src/server/services/factory-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authentication = authenticateCronRequest(request);
  if (!authentication.authorized) {
    return fail(401, "Factory scheduler authentication failed.", authentication.diagnostics);
  }
  const dispatcher = new FactoryDispatcher();
  const result = await dispatcher.runCycle();
  return ok(result, { headers: { "Cache-Control": "no-store" } });
}
