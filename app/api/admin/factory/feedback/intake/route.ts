import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryFeedbackIntakeSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request) => {
  const input = factoryFeedbackIntakeSchema.parse(await request.json());
  return ok(await adminService.intakeFactoryFeedback(input), { status: 201 });
});
