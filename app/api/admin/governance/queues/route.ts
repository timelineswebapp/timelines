import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { governanceQueueSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

export const POST = withAdminAuth(async (request: Request, _context, identity) => {
  const body = await request.json();
  const input = governanceQueueSchema.parse(body);
  await resolveInstitutionalActor(identity, "governance.queue.create", ["governance"]);
  return ok(await adminService.createGovernanceQueue(input), { status: 201 });
}, { roles: ["governance_operator"] });
