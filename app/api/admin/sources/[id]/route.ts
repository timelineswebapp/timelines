import { fail, fromError, ok } from "@/src/server/api/responses";
import { isAdminAuthorized } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { sourceSchema } from "@/src/server/validation/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isAdminAuthorized(request)) {
      return fail(401, "Unauthorized.");
    }
    const { id } = await params;
    const body = await request.json();
    const input = sourceSchema.parse(body);
    const updated = await adminService.updateSource(Number(id), input);
    if (!updated) {
      return fail(404, "Source not found.");
    }
    return ok(updated);
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isAdminAuthorized(request)) {
      return fail(401, "Unauthorized.");
    }
    const { id } = await params;
    const deleted = await adminService.deleteSource(Number(id));
    if (!deleted) {
      return fail(404, "Source not found.");
    }
    return ok({ deleted: true });
  } catch (error) {
    return fromError(error);
  }
}
