export const dynamic = "force-dynamic";

import { contentService } from "@/src/server/services/content-service";
import { fromError, ok } from "@/src/server/api/responses";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 12);
    const timelines = await contentService.listFeaturedTimelines(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 12);
    return ok(timelines);
  } catch (error) {
    return fromError(error);
  }
}
