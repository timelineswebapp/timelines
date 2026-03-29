import type { Metadata } from "next";
import { config } from "@/src/lib/config";
import {
  buildEventOgImagePath,
  buildEventPath,
  buildTimelineOgImagePath,
  buildTimelinePath,
  summarizeShareText
} from "@/src/lib/share";
import type { EventRecord, TimelineDetail } from "@/src/lib/types";

function absoluteUrl(path: string): string {
  return `${config.siteUrl}${path}`;
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
    const canonicalUrl = absoluteUrl(canonicalPath);
    const imageUrl = absoluteUrl(buildEventOgImagePath(shareEvent.id));
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
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl(buildTimelineOgImagePath(timeline.slug));

  return {
    title: `${timeline.title} | TiMELiNES`,
    description: timeline.description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title: timeline.title,
      description: timeline.description,
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
      title: timeline.title,
      description: timeline.description,
      images: [imageUrl]
    }
  };
}
