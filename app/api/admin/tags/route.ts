import { fail, fromError, ok } from "@/src/server/api/responses";
import { isAdminAuthorized } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { tagSchema } from "@/src/server/validation/schemas";

export async function GET(request: Request) {
  try {
    if (!isAdminAuthorized(request)) {
      return fail(401, "Unauthorized.");
    }
    return ok(await adminService.listTags());
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isAdminAuthorized(request)) {
      return fail(401, "Unauthorized.");
    }
    const body = await request.json();
    const input = tagSchema.parse(body);
    return ok(await adminService.createTag(input), { status: 201 });
  } catch (error) {
    return fromError(error);
  }
}
