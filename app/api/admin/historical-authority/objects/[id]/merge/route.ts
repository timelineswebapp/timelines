import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalObjectMergeSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const id = uuidParamSchema.parse(rawId);
  const body = await request.json();
  const input = historicalObjectMergeSchema.parse(body);
  return ok(await adminService.mergeHistoricalObject(id, input.targetObjectId, input));
});
