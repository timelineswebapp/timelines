import type { Metadata } from "next";
import { buildPublicUrl } from "@/src/lib/public-site";
import {
  buildEventOgImagePath,
  buildEventPath,
  buildMilestonePath,
  buildTimelineOgImagePath,
  buildTimelinePath,
  summarizeShareText
} from "@/src/lib/share";
import type { EventRecord, TimelineDetail } from "@/src/lib/types";
import { formatDisplayDate } from "@/src/lib/utils";

function buildTimelineMetadataDescription(timeline: TimelineDetail): string {
  const sourceCount = new Set(timeline.events.flatMap((event) => event.sources.map((source) => source.id))).size;
  const sourceText = sourceCount > 0 ? ` with ${sourceCount} cited sources` : "";
  return `Canonical chronology of ${timeline.title}: ${timeline.eventCount} dated milestones${sourceText}, organized for historical reference.`;
}

export function resolveTimelineShareEvent(
  timeline: TimelineDetail,
  eventId: number | null
): EventRecord | null {
  if (eventId === null) {
    return null;
  }

  return timeline.events.find((event) => event.id === eventId) || null;
}

export function buildTimelinePageMetadata(timeline: TimelineDetail, shareEvent: EventRecord | null): Metadata {
  if (shareEvent) {
    const canonicalPath = buildEventPath(timeline.slug, shareEvent.id);
    const canonicalUrl = buildPublicUrl(canonicalPath);
    const imageUrl = buildPublicUrl(buildEventOgImagePath(shareEvent.id));
    const displayDate = formatDisplayDate(shareEvent.date, shareEvent.datePrecision, {
      displayDate: shareEvent.displayDate,
      sortYear: shareEvent.sortYear,
      sortMonth: shareEvent.sortMonth,
      sortDay: shareEvent.sortDay
    });
    const description = summarizeShareText(`${displayDate}: ${shareEvent.description}`, 200);

    return {
      title: `${shareEvent.title} | ${timeline.title} | TiMELiNES`,
      description,
      alternates: {
        canonical: canonicalPath
      },
      openGraph: {
        title: shareEvent.title,
        description,
        url: canonicalUrl,
        type: "article",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: `${shareEvent.title} preview image`
          }
        ]
      },
      twitter: {
        card: "summary_large_image",
        title: shareEvent.title,
        description,
        images: [imageUrl]
      }
    };
  }

  const canonicalPath = buildTimelinePath(timeline.slug);
  const canonicalUrl = buildPublicUrl(canonicalPath);
  const imageUrl = buildPublicUrl(buildTimelineOgImagePath(timeline.slug));
  const title = `Timeline of ${timeline.title} | TiMELiNES`;
  const description = buildTimelineMetadataDescription(timeline);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${timeline.title} preview image`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl]
    }
  };
}

export function buildMilestonePageMetadata(event: EventRecord): Metadata {
  const canonicalPath = buildMilestonePath(event.id, event.title);
  const canonicalUrl = buildPublicUrl(canonicalPath);
  const imageUrl = buildPublicUrl(buildEventOgImagePath(event.id));
  const displayDate = formatDisplayDate(event.date, event.datePrecision, {
    displayDate: event.displayDate,
    sortYear: event.sortYear,
    sortMonth: event.sortMonth,
    sortDay: event.sortDay
  });
  const description = summarizeShareText(`${displayDate}: ${event.description}`, 200);
  const title = `${event.title} | Milestone | TiMELiNES`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title: event.title,
      description,
      url: canonicalUrl,
      type: "article",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${event.title} milestone preview image`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [imageUrl]
    }
  };
}
