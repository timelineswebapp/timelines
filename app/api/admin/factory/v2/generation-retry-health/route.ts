import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

/** Read-only aggregate retry health; recovery remains scheduler-owned. */
export const GET = withAdminAuth(async () => ok(await adminService.getGenerationRetryQueueHealth()), { roles: ["factory_operator"] });
