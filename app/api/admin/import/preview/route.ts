import { fail, fromError, ok } from "@/src/server/api/responses";
import { isAdminAuthorized } from "@/src/server/api/admin-auth";
import { importService } from "@/src/server/services/import-service";

export async function POST(request: Request) {
  try {
    if (!isAdminAuthorized(request)) {
      return fail(401, "Unauthorized.");
    }
    return ok(await importService.preview(await request.json()));
  } catch (error) {
    return fromError(error);
  }
}
