import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalLibraryRetirementSchema, uuidParamSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }, identity) => {
  const { id: rawId } = await params;
  const publishedSnapshotId = uuidParamSchema.parse(rawId);
  const input = historicalLibraryRetirementSchema.omit({ actor: true }).parse(await request.json());
  return ok(await adminService.retirePublishedMemory({ ...input, publishedSnapshotId, actor: await resolveInstitutionalActor(identity, "historical_library.snapshot.retire", ["historical_library"]) }), { status: 201 });
}, { roles: ["library_operator"] });
