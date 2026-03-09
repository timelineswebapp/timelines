import { contentService } from "@/src/server/services/content-service";
import { fail, fromError, ok } from "@/src/server/api/responses";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const detail = await contentService.getTagDetail(slug);
    if (!detail) {
      return fail(404, "Tag not found.");
    }
    return ok(detail);
  } catch (error) {
    return fromError(error);
  }
}
