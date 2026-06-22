import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryGovernanceHandoffSubmissionSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request, context: { params: { id: string } }) => {
  const input = factoryGovernanceHandoffSubmissionSchema.parse(await request.json());
  return ok(await adminService.submitFactoryGovernanceHandoff({ ...input, handoffId: context.params.id }));
});
