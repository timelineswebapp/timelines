import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const detail = await contentService.getTagDetail(slug);

  if (!detail) {
    return {
      title: "Tag not found | TiMELiNES",
      alternates: {
        canonical: `/tag/${slug}`
      }
    };
  }

  return {
    title: `${detail.tag.name} timelines | TiMELiNES`,
    description: `Browse timelines connected by the ${detail.tag.name} tag.`,
    alternates: {
      canonical: `/tag/${detail.tag.slug}`
    }
  };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await contentService.getTagDetail(slug);
  if (!detail) {
    notFound();
  }

  return (
    <div className="content-grid">
      <GlassPanel>
        <span className="eyebrow">Tag</span>
        <h1 className="page-title" style={{ fontFamily: "var(--font-serif)" }}>{detail.tag.name}</h1>
        <p className="section-copy">Events attach tags, and timelines inherit discovery through those event-level relationships.</p>
      </GlassPanel>
      <section className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {detail.timelines.map((timeline) => (
          <TimelineSummaryCard key={timeline.id} timeline={timeline} />
        ))}
      </section>
    </div>
  );
}
