import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { disputeResolutionTransitionSchema, uuidParamSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }, identity) => {
  const { id: rawId } = await params;
  const id = uuidParamSchema.parse(rawId);
  const input = disputeResolutionTransitionSchema.omit({ actor: true }).parse(await request.json());
  return ok(await adminService.resolveGovernanceDispute({ ...input, id, actor: await resolveInstitutionalActor(identity, "governance.dispute.resolve", ["governance"]) }));
}, { roles: ["governance_operator"] });
