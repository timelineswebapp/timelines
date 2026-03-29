import type { Metadata } from "next";
import { buildPublicUrl } from "@/src/lib/public-site";
import {
  buildEventOgImagePath,
  buildEventPath,
  buildTimelineOgImagePath,
  buildTimelinePath,
  summarizeShareText
} from "@/src/lib/share";
import type { EventRecord, TimelineDetail } from "@/src/lib/types";

function buildTimelineMetadataDescription(title: string): string {
  return `Chronological timeline of ${title}, major events, dates, and historical milestones.`;
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
    const description = summarizeShareText(shareEvent.description, 200);

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
  const description = buildTimelineMetadataDescription(timeline.title);

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
