export const dynamic = "force-dynamic";

import { ApiError, fromError, ok } from "@/src/server/api/responses";
import { contentService } from "@/src/server/services/content-service";
import { searchQuerySchema } from "@/src/server/validation/schemas";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    for (const key of ["q", "limit", "offset"]) {
      if (searchParams.getAll(key).length > 1) throw new ApiError(400, "VALIDATION_FAILED", `Query parameter ${key} must appear at most once.`);
    }
    const input = searchQuerySchema.parse({
      q: searchParams.get("q") || "",
      limit: searchParams.get("limit") || 12,
      offset: searchParams.get("offset") || 0
    });

    const result = await contentService.searchKnowledge(input.q, input.limit, input.offset);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
