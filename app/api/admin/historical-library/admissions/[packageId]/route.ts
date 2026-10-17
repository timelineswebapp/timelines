import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalLibraryAdmissionSchema, uuidParamSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ packageId: string }> }, identity) => {
  const { packageId: rawPackageId } = await params;
  const packageId = uuidParamSchema.parse(rawPackageId);
  const input = historicalLibraryAdmissionSchema.omit({ actor: true }).parse(await request.json());

  return ok(await adminService.admitPublicationPackageToHistoricalLibrary({ ...input, packageId, actor: await resolveInstitutionalActor(identity, "historical_library.admission.admit", ["historical_library"]) }), { status: 201 });
}, { roles: ["library_operator"] });
