import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { parseOptionalSingleQueryParameter } from "@/src/server/api/query-params";
import { adminService } from "@/src/server/services/admin-service";
import { factoryEditorialDecisionSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const POST = withAdminAuth(async (request: Request) => {
  const reviewId = uuidParamSchema.parse(parseOptionalSingleQueryParameter(new URL(request.url).searchParams, "reviewId") || "");
  const input = factoryEditorialDecisionSchema.parse(await request.json());
  if (input.decision === "approve") {
    const { decision: _decision, ...approval } = input;
    return ok(await adminService.approveEditorialReview({ ...approval, editorialReviewId: reviewId }));
  }
  const { decision: _decision, ...revision } = input;
  return ok(await adminService.requireFactoryEditorialRevision({ ...revision, editorialReviewId: reviewId }));
}, { roles: ["factory_operator"] });
