import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalLibraryWithdrawalSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const publishedSnapshotId = uuidParamSchema.parse(rawId);
  const input = historicalLibraryWithdrawalSchema.parse(await request.json());
  return ok(await adminService.withdrawPublishedMemory({ ...input, publishedSnapshotId }), { status: 201 });
}, { roles: ["library_operator"] });
