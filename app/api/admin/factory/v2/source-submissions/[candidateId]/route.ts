import { ApiError, ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";

const candidateIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u;

export const GET = withAdminAuth(async (_request: Request, context: { params: Promise<{ candidateId: string }> }) => {
  const { candidateId } = await context.params;
  if (!candidateIdPattern.test(candidateId)) throw new ApiError(400, "VALIDATION_FAILED", "Source submission candidate ID is invalid.");
  return ok(await adminService.getFactoryV2SourceSubmissionInspection(candidateId));
}, { roles: ["factory_operator"] });
