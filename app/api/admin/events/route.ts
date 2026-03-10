import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { eventSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async () => ok(await adminService.listEvents()));

export const POST = withAdminAuth(async (request: Request) => {
  const body = await request.json();
  const input = eventSchema.parse(body);
  return ok(await adminService.createEvent(input), { status: 201 });
});
