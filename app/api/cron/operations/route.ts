import { fail, ok } from "@/src/server/api/responses";
import { isAuthorizedCronRequest } from "@/src/server/api/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return fail(401, "Scheduled operations authentication failed.");
  return ok(
    {
      deprecated: true,
      message: "Use the institution-specific /api/cron/factory, /api/cron/governance, and /api/cron/maintenance schedulers."
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
