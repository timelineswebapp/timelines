import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { approvalSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

const approvalRequestSchema = approvalSchema.extend({
  request: approvalSchema.shape.request.omit({ requestedBy: true })
});

export const POST = withAdminAuth(async (request: Request, _context, identity) => {
  const body = await request.json();
  const input = approvalRequestSchema.parse(body);
  return ok(await adminService.createGovernanceApproval({
    ...input,
    request: {
      ...input.request,
      requestedBy: await resolveInstitutionalActor(identity, "governance.approval.create", ["governance"])
    }
  }), { status: 201 });
}, { roles: ["governance_operator"] });
