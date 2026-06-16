import { ImageResponse } from "next/og";
import { formatHistoricalYearLabel } from "@/src/lib/historical-date";
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
  const chronologicalEvents = [...resolution.timeline.events].sort((left, right) => {
    const leftYear = left.sortYear ?? Number.parseInt(left.legacyDate || left.date, 10);
    const rightYear = right.sortYear ?? Number.parseInt(right.legacyDate || right.date, 10);
    return leftYear - rightYear;
  });
  const firstEvent = chronologicalEvents[0];
  const lastEvent = chronologicalEvents[chronologicalEvents.length - 1];
  const dateRange = firstEvent && lastEvent
    ? [
        formatHistoricalYearLabel({
          date: firstEvent.legacyDate || firstEvent.date,
          datePrecision: firstEvent.datePrecision,
          displayDate: firstEvent.displayDate,
          sortYear: firstEvent.sortYear
        }),
        formatHistoricalYearLabel({
          date: lastEvent.legacyDate || lastEvent.date,
          datePrecision: lastEvent.datePrecision,
          displayDate: lastEvent.displayDate,
          sortYear: lastEvent.sortYear
        })
      ]
    : [];
  const meta = dateRange.length === 2 && dateRange[0] !== dateRange[1] ? `${dateRange[0]}-${dateRange[1]}` : dateRange[0];

  return new ImageResponse(
    await renderSocialImage({
      title: resolution.timeline.title,
      category: resolution.timeline.category,
      meta
    }),
    SOCIAL_IMAGE_SIZE
  );
}
