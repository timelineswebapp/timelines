import { z } from "zod";
import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { uuidParamSchema } from "@/src/server/validation/schemas";

const schema = z.object({ action: z.enum(["acknowledge", "resolve"]), actor: z.string().trim().min(2).max(120) });
export const PATCH = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const input = schema.parse(await request.json());
  return ok(await adminService.transitionOperationalAlert(uuidParamSchema.parse(id), input.action, input.actor));
}, { roles: ["admin"] });
