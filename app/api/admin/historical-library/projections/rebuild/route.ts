import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

export const dynamic = "force-dynamic";

export const POST = withAdminAuth(async () => ok(await adminService.rebuildPublishedMemoryProjections()), { roles: ["library_operator"] });
