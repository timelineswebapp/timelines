import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalLibrarySplitSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const sourcePublishedRecordId = uuidParamSchema.parse(rawId);
  const input = historicalLibrarySplitSchema.parse(await request.json());
  return ok(await adminService.splitPublishedMemory({ ...input, sourcePublishedRecordId }), { status: 201 });
}, { roles: ["library_operator"] });
