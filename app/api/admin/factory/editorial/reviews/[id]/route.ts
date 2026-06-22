import { ok } from "@/src/server/api/responses";
import { withAdminAuth } from "@/src/server/api/admin-auth";
import { adminService } from "@/src/server/services/admin-service";
import { factoryCandidateReviewSchema, uuidParamSchema } from "@/src/server/validation/schemas";

export const GET = withAdminAuth(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const reviewId = uuidParamSchema.parse(rawId);
  return ok(await adminService.getFactoryEditorialReview(reviewId));
});

export const POST = withAdminAuth(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await params;
  const editorialReviewId = uuidParamSchema.parse(rawId);
  const input = factoryCandidateReviewSchema.parse(await request.json());
  return ok(await adminService.reviewCandidatePackage({ ...input, editorialReviewId }));
});
