export const dynamic = "force-dynamic";

import { contentService } from "@/src/server/services/content-service";
import { fromError, ok } from "@/src/server/api/responses";
import { parseBoundedIntegerQueryParameter } from "@/src/server/api/query-params";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseBoundedIntegerQueryParameter(searchParams.get("limit"), 12, 1, 50);
    const timelines = await contentService.listFeaturedTimelines(limit);
    return ok(timelines);
  } catch (error) {
    return fromError(error);
  }
}
