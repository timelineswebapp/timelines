import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { milestoneParticipationSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request) => {
  const body = await request.json();
  const input = milestoneParticipationSchema.parse(body);
  return ok(await adminService.createMilestoneParticipation(input), { status: 201 });
}, { roles: ["admin"] });
