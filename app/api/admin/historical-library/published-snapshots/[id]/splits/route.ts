import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalLibrarySplitSchema, uuidParamSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }, identity) => {
  const { id: rawId } = await params;
  const sourcePublishedRecordId = uuidParamSchema.parse(rawId);
  const input = historicalLibrarySplitSchema.omit({ actor: true }).parse(await request.json());
  return ok(await adminService.splitPublishedMemory({ ...input, sourcePublishedRecordId, actor: await resolveInstitutionalActor(identity, "historical_library.snapshot.split", ["historical_library"]) }), { status: 201 });
}, { roles: ["library_operator"] });
