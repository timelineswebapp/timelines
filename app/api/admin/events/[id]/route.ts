import { fail, ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { eventSchema } from "@/src/server/validation/schemas";

export const PATCH = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await request.json();
  const input = eventSchema.parse(body);
  const updated = await adminService.updateEvent(Number(id), input);
  if (!updated) {
    return fail(404, "Event not found.");
  }
  return ok(updated);
});

export const DELETE = withAdminAuth(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const deleted = await adminService.deleteEvent(Number(id));
  if (!deleted) {
    return fail(404, "Event not found.");
  }
  return ok({ deleted: true });
});
