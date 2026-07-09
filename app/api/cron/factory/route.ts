import { fail, ok } from "@/src/server/api/responses";
import { isAuthorizedCronRequest } from "@/src/server/api/cron-auth";
import { FactoryDispatcher } from "@/src/server/services/factory-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deploymentDiagnostics() {
  let databaseHostname = "unconfigured";
  try {
    databaseHostname = process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL).hostname
      : "unconfigured";
  } catch {
    databaseHostname = "invalid";
  }
  return {
    deploymentUrl: process.env.VERCEL_URL || "local",
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    databaseHostname
  };
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return fail(401, "Factory scheduler authentication failed.");
  const cronStartedAt = Date.now();
  const cronStartedIso = new Date(cronStartedAt).toISOString();
  const diagnostics = deploymentDiagnostics();
  console.info(JSON.stringify({
    level: "info",
    component: "factory_cron",
    event: "factory_cron_started",
    cronRequestStartedAt: cronStartedIso,
    ...diagnostics
  }));
  const dispatcher = new FactoryDispatcher();
  const result = await dispatcher.runCycle();
  const cronFinishedAt = Date.now();
  console.info(JSON.stringify({
    level: "info",
    component: "factory_cron",
    event: "factory_cron_completed",
    cronRequestStartedAt: cronStartedIso,
    httpResponseReturnedAt: new Date(cronFinishedAt).toISOString(),
    totalCronDurationMs: cronFinishedAt - cronStartedAt,
    ...diagnostics,
    leasedWorkItemIds: "outcomes" in result && Array.isArray(result.outcomes)
      ? result.outcomes.map((outcome) => outcome.topicId)
      : [],
    result
  }));
  return ok(result, { headers: { "Cache-Control": "no-store" } });
}
