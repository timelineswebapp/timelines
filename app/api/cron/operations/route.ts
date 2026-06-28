import { timingSafeEqual } from "node:crypto";
import { fail, ok } from "@/src/server/api/responses";
import { scheduledOperationsService } from "@/src/server/services/scheduled-operations-service";
import { FactoryDispatcher } from "@/src/server/services/factory-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !supplied || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export async function GET(request: Request) {
  if (!authorized(request)) return fail(401, "Scheduled operations authentication failed.");
  const dispatcher = new FactoryDispatcher();
  const [factory, scheduled] = await Promise.all([
    dispatcher.runCycle(),
    scheduledOperationsService.runDue()
  ]);
  return ok({ factory, scheduled }, { headers: { "Cache-Control": "no-store" } });
}
