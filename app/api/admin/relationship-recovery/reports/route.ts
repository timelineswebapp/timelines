import { ApiError, fromError, ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminAuth(async () => {
  try {
    return ok(await adminService.listRelationshipRecoveryReports());
  } catch (error) {
    if (error instanceof ApiError) {
      return fromError(error);
    }

    console.error(
      JSON.stringify({
        level: "error",
        component: "relationship_recovery_reports_route",
        message: error instanceof Error ? error.message : "Unexpected relationship recovery history error.",
        stack: error instanceof Error ? error.stack : undefined
      })
    );

    return fromError(error);
  }
}, { roles: ["admin"] });
