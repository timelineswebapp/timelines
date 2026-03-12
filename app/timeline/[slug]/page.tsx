import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TimelineDetailView } from "@/components/timeline/TimelineDetailView";
import { adsService } from "@/src/server/services/ads-service";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

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

  return <TimelineDetailView timeline={timeline} adAssignments={adAssignments} />;
}
