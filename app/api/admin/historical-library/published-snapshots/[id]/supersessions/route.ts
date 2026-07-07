import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalLibrarySupersessionSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const previousPublishedRecordId = uuidParamSchema.parse(rawId);
  const input = historicalLibrarySupersessionSchema.parse(await request.json());
  return ok(await adminService.supersedePublishedMemory({ ...input, previousPublishedRecordId }), { status: 201 });
}, { roles: ["library_operator"] });
