import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { parseOptionalSingleQueryParameter } from "@/src/server/api/query-params";
import { adminService } from "@/src/server/services/admin-service";
import { uuidParamSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async (request: Request) => {
  const jobId = parseOptionalSingleQueryParameter(new URL(request.url).searchParams, "jobId");
  const validatedJobId = jobId === undefined ? undefined : uuidParamSchema.parse(jobId);
  return ok(await adminService.listFactoryRuntimeExecutions(validatedJobId));
}, { roles: ["factory_operator"] });
