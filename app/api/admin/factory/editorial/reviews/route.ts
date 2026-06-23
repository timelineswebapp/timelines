import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryCandidateValidationSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async () => ok(await adminService.listFactoryEditorialReviews()), { roles: ["factory_operator"] });

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryCandidateValidationSchema.parse(await request.json());
  return ok(await adminService.validateCandidatePackage(input), { status: 201 });
}, { roles: ["factory_operator"] });
