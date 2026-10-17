import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalLibraryRevisionSchema, uuidParamSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }, identity) => {
  const { id: rawId } = await params;
  const publishedSnapshotId = uuidParamSchema.parse(rawId);
  const input = historicalLibraryRevisionSchema.omit({ actor: true }).parse(await request.json());
  return ok(await adminService.revisePublishedMemory({ ...input, publishedSnapshotId, actor: await resolveInstitutionalActor(identity, "historical_library.snapshot.revise", ["historical_library"]) }), { status: 201 });
}, { roles: ["library_operator"] });
