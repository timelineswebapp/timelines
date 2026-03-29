import { ImageResponse } from "next/og";
import { renderSocialImage, SOCIAL_IMAGE_SIZE } from "@/src/lib/social-image";
import { contentService } from "@/src/server/services/content-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const parsedEventId = Number(eventId);
  if (!Number.isSafeInteger(parsedEventId) || parsedEventId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const context = await contentService.getEventShareContext(parsedEventId);
  if (!context) {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    await renderSocialImage({
      title: context.event.title
    }),
    SOCIAL_IMAGE_SIZE
  );
}
