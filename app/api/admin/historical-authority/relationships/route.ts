import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { historicalRelationshipSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async () => ok(await adminService.listHistoricalRelationships()));

export const POST = withAdminAuth(async (request: Request) => {
  const input = historicalRelationshipSchema.parse(await request.json());
  return ok(await adminService.createHistoricalRelationship(input), { status: 201 });
});
