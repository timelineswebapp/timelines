import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { governanceDecisionSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

export const POST = withAdminAuth(async (request: Request, _context, identity) => {
  const body = await request.json();
  const input = governanceDecisionSchema.omit({ actor: true }).parse(body);
  return ok(await adminService.createGovernanceDecision({ ...input, actor: await resolveInstitutionalActor(identity, "governance.decision.create", ["governance"]) }), { status: 201 });
}, { roles: ["governance_operator"] });
