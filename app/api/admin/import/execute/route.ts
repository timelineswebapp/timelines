import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { importService } from "@/src/server/services/import-service";

export const POST = withAdminAuth(async (request: Request) => ok(await importService.execute(await request.json())));
