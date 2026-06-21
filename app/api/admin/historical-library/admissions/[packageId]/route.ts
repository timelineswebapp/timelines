import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalLibraryAdmissionSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ packageId: string }> }) => {
  const { packageId: rawPackageId } = await params;
  const packageId = uuidParamSchema.parse(rawPackageId);
  const input = historicalLibraryAdmissionSchema.parse(await request.json());

  return ok(await adminService.admitPublicationPackageToHistoricalLibrary({ ...input, packageId }), { status: 201 });
});
