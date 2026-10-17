import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { feedbackPackageSchema } from "@/src/server/validation/schemas";
import { resolveInstitutionalActor } from "@/src/server/security/institutional-actor-resolution";

const governanceFeedbackPackageSchema = feedbackPackageSchema.extend({
  origin: feedbackPackageSchema.shape.origin.omit({ originActor: true }).extend({ originService: feedbackPackageSchema.shape.origin.shape.originService.extract(["governance"]) })
});

export const POST = withAdminAuth(async (request: Request, _context, identity) => {
  const body = await request.json();
  const input = governanceFeedbackPackageSchema.parse(body);
  return ok(await adminService.createFeedbackPackage({
    ...input,
    origin: {
      ...input.origin,
      originActor: await resolveInstitutionalActor(identity, "governance.feedback.create", ["governance"])
    }
  }), { status: 201 });
}, { roles: ["governance_operator"] });
