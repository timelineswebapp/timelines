import { ImageResponse } from "next/og";
import { renderSocialImage, SOCIAL_IMAGE_SIZE } from "@/src/lib/social-image";
import { summarizeShareText } from "@/src/lib/share";
import { contentService } from "@/src/server/services/content-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resolution = await contentService.resolveTimelineRoute(slug);
  if (!resolution.timeline) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    renderSocialImage({
      eyebrow: resolution.timeline.category,
      title: resolution.timeline.title,
      subtitle: summarizeShareText(resolution.timeline.description, 140)
    }),
    SOCIAL_IMAGE_SIZE
  );
}
