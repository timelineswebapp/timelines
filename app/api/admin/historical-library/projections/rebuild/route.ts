import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

export const dynamic = "force-dynamic";

export const POST = withAdminAuth(async (request: Request) => {
  const body = await request.json().catch(() => ({})) as { incremental?: unknown; batchSize?: unknown };
  const incremental = body.incremental === true;
  const batchSize = typeof body.batchSize === "number" ? Math.max(1, Math.min(1000, Math.trunc(body.batchSize))) : undefined;
  return ok(await adminService.rebuildPublishedMemoryProjections({ incremental, batchSize }));
}, { roles: ["library_operator"] });
