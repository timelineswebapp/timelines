import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TimelineDetailView } from "@/components/timeline/TimelineDetailView";
import { getMockTimelineDetail, mockTimelineSlugs } from "@/src/lib/mock-timelines";
import { adsService } from "@/src/server/services/ads-service";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await contentService.listStaticSlugs(50);
  return Array.from(new Set([...slugs, ...mockTimelineSlugs])).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const timeline = (await contentService.getTimeline(slug)) || getMockTimelineDetail(slug);
  if (!timeline) {
    return {
      title: "Timeline not found"
    };
  }

  return {
    title: `${timeline.title} | TiMELiNES`,
    description: timeline.description
  };
}

export default async function TimelinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [timeline, adAssignments] = await Promise.all([
    contentService.getTimeline(slug).then((result) => result || getMockTimelineDetail(slug)),
    adsService.getPublicAssignments(["timeline_inline_1", "timeline_inline_2", "timeline_bottom"])
  ]);
  if (!timeline) {
    notFound();
  }

  return <TimelineDetailView timeline={timeline} adAssignments={adAssignments} />;
}
