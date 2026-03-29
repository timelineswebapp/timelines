import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TimelineDetailView } from "@/components/timeline/TimelineDetailView";
import { buildTimelineJsonLd } from "@/src/lib/timeline-jsonld";
import { buildEventPath, buildTimelinePath, parseEventIdParam } from "@/src/lib/share";
import { buildTimelinePageMetadata, resolveTimelineShareEvent } from "@/src/lib/social-metadata";
import { adsService } from "@/src/server/services/ads-service";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

function sanitizeJsonLd<T>(value: T): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function generateStaticParams() {
  const slugs = await contentService.listStaticSlugs(50);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ event?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { event } = await searchParams;
  const resolution = await contentService.resolveTimelineRoute(slug);
  if (!resolution.timeline) {
    return {
      title: "Timeline not found",
      alternates: {
        canonical: `/timeline/${slug}`
      }
    };
  }

  const shareEvent = resolveTimelineShareEvent(resolution.timeline, parseEventIdParam(event));
  return buildTimelinePageMetadata(resolution.timeline, shareEvent);
}

export default async function TimelinePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { slug } = await params;
  const { event } = await searchParams;
  const selectedEventId = parseEventIdParam(event);
  const [resolution, adAssignments] = await Promise.all([
    contentService.resolveTimelineRoute(slug),
    adsService.getPublicAssignments(["timeline_inline_1", "timeline_inline_2", "timeline_bottom"])
  ]);
  if (!resolution.timeline) {
    notFound();
  }

  if (resolution.redirectSlug && resolution.redirectSlug !== slug) {
    permanentRedirect(
      selectedEventId !== null
        ? buildEventPath(resolution.redirectSlug, selectedEventId)
        : buildTimelinePath(resolution.redirectSlug)
    );
  }

  const timeline = resolution.timeline;
  const timelineJsonLd = buildTimelineJsonLd(timeline);
  const initialSelectedEventId = timeline.events.some((eventItem) => eventItem.id === selectedEventId) ? selectedEventId : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: sanitizeJsonLd(timelineJsonLd) }}
      />
      <TimelineDetailView timeline={timeline} initialSelectedEventId={initialSelectedEventId} adAssignments={adAssignments} />
    </>
  );
}
