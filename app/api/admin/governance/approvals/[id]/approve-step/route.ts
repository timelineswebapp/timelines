import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { approvalStepTransitionSchema, uuidParamSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }, identity) => {
  const { id: rawId } = await params;
  const id = uuidParamSchema.parse(rawId);
  const input = approvalStepTransitionSchema.omit({ actor: true }).parse(await request.json());
  return ok(await adminService.approveGovernanceApprovalStep({ ...input, id, actor: await resolveInstitutionalActor(identity, "governance.approval.approve_step", ["governance"]) }));
}, { roles: ["governance_operator"] });
