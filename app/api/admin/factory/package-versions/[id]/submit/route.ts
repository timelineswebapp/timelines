import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryGovernanceSubmissionSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const packageVersionId = uuidParamSchema.parse(rawId);
  const input = factoryGovernanceSubmissionSchema.parse(await request.json());
  return ok(await adminService.markFactoryPackageVersionSubmitted({ ...input, packageVersionId }));
});
