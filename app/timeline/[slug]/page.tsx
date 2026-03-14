import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TimelineDetailView } from "@/components/timeline/TimelineDetailView";
import { config } from "@/src/lib/config";
import { adsService } from "@/src/server/services/ads-service";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

function sanitizeJsonLd<T>(value: T): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function summarizeEventDescription(description: string, maxLength: number) {
  const normalized = description.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getStructuredEventDate(date: string | null | undefined) {
  if (!date) {
    return undefined;
  }

  const normalized = date.trim();
  return /^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(normalized) ? normalized : undefined;
}

function buildTimelineJsonLd(timeline: NonNullable<Awaited<ReturnType<typeof contentService.getTimeline>>>) {
  const url = `${config.siteUrl}/timeline/${timeline.slug}`;
  const itemListElement = timeline.events.slice(0, 20).map((event, index) => {
    const item: {
      "@type": "ListItem";
      position: number;
      name: string;
      description: string;
      startDate?: string;
    } = {
      "@type": "ListItem",
      position: index + 1,
      name: event.title,
      description: summarizeEventDescription(event.description, index < 10 ? 240 : 120)
    };

    const startDate = getStructuredEventDate(event.legacyDate || event.date);
    if (startDate) {
      item.startDate = startDate;
    }

    return item;
  });

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    headline: timeline.title,
    description: timeline.description,
    url,
    mainEntity: {
      "@type": "ItemList",
      name: timeline.title,
      numberOfItems: itemListElement.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement
    }
  };
}

export async function generateStaticParams() {
  const slugs = await contentService.listStaticSlugs(50);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const timeline = await contentService.getTimeline(slug);
  if (!timeline) {
    return {
      title: "Timeline not found",
      alternates: {
        canonical: `/timeline/${slug}`
      }
    };
  }

  return {
    title: `${timeline.title} | TiMELiNES`,
    description: timeline.description,
    alternates: {
      canonical: `/timeline/${timeline.slug}`
    }
  };
}

export default async function TimelinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [timeline, adAssignments] = await Promise.all([
    contentService.getTimeline(slug),
    adsService.getPublicAssignments(["timeline_inline_1", "timeline_inline_2", "timeline_bottom"])
  ]);
  if (!timeline) {
    notFound();
  }

  const timelineJsonLd = buildTimelineJsonLd(timeline);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: sanitizeJsonLd(timelineJsonLd) }}
      />
      <TimelineDetailView timeline={timeline} adAssignments={adAssignments} />
    </>
  );
}
