import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

export const GET = withAdminAuth(async () => ok(await adminService.getFactoryRuntimeMetrics()), { roles: ["factory_operator"] });
