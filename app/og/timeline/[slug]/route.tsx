import { ImageResponse } from "next/og";
import { renderSocialImage, SOCIAL_IMAGE_SIZE } from "@/src/lib/social-image";
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
    await renderSocialImage({
      title: resolution.timeline.title
    }),
    SOCIAL_IMAGE_SIZE
  );
}
