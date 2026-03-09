export const dynamic = "force-dynamic";

import { fromError, ok } from "@/src/server/api/responses";
import { contentService } from "@/src/server/services/content-service";
import { searchQuerySchema } from "@/src/server/validation/schemas";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchQuerySchema.parse({
      q: searchParams.get("q") || "",
      limit: searchParams.get("limit") || 12
    });

    const result = await contentService.searchTimelines(input.q, input.limit);
    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
