import { contentService } from "@/src/server/services/content-service";
import { fail, fromError, ok } from "@/src/server/api/responses";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const timeline = await contentService.getTimeline(slug);
    if (!timeline) {
      return fail(404, "Timeline not found.");
    }
    return ok(timeline);
  } catch (error) {
    return fromError(error);
  }
}
