import { fail, ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalObjectRevisionSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const PATCH = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const id = uuidParamSchema.parse(rawId);
  const body = await request.json();
  const input = historicalObjectRevisionSchema.parse(body);
  const updated = await adminService.reviseHistoricalObject(id, input);
  if (!updated) {
    return fail(404, "Historical object not found.");
  }
  return ok(updated);
}, { roles: ["admin"] });
