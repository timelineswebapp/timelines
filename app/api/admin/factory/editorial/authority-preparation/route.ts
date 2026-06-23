import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import {
  factoryAuthorityPreparationSchema,
  factoryGovernanceReadinessAssessmentSchema
} from "@/src/server/validation/schemas";
import { adminService } from "@/src/server/services/admin-service";

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryAuthorityPreparationSchema.parse(await request.json());
  return ok(await adminService.prepareFactoryAuthorityRecords(input), { status: 201 });
}, { roles: ["factory_operator"] });

export const PUT = withAdminAuth(async (request: Request) => {
  const input = factoryGovernanceReadinessAssessmentSchema.parse(await request.json());
  return ok(await adminService.assessFactoryGovernanceReadiness(input));
}, { roles: ["factory_operator"] });
