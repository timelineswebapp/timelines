import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { adCampaignSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async () => ok(await adminService.getAdsDashboardData()));

export const POST = withAdminAuth(async (request: Request) => {
  const body = await request.json();
  const input = adCampaignSchema.parse(body);
  return ok(await adminService.createAdCampaign(input), { status: 201 });
});
