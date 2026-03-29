import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { buildPublicUrl } from "@/src/lib/public-site";
import { buildCategoryJsonLd, sanitizeJsonLd } from "@/src/lib/timeline-jsonld";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

const CATEGORY_INTROS: Record<string, string> = {
  war: "Explore military campaigns, conflicts, turning points, and postwar consequences through structured timeline pages.",
  science: "Explore scientific discoveries, experiments, theories, and institutional milestones through structured timeline pages.",
  politics: "Explore elections, constitutions, revolutions, governments, and policy turning points through structured timeline pages.",
  philosophy: "Explore philosophical schools, thinkers, texts, and debates through structured timeline pages.",
  technology: "Explore inventions, platforms, infrastructure, and technical breakthroughs through structured timeline pages.",
  culture: "Explore artistic, literary, media, and cultural movements through structured timeline pages."
};

function getCategoryIntro(slug: string, categoryName: string) {
  return CATEGORY_INTROS[slug] || `Explore ${categoryName.toLowerCase()} timelines through structured chronology pages connected by shared themes, events, and developments.`;
}

export async function generateStaticParams() {
  const categories = await contentService.listCategoryEntries();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const detail = await contentService.getCategoryDetail(slug);

  if (!detail) {
    return {
      title: "Category not found | TiMELiNES",
      alternates: {
        canonical: `/category/${slug}`
      }
    };
  }

  return {
    title: `${detail.category.name} timelines | TiMELiNES`,
    description: getCategoryIntro(detail.category.slug, detail.category.name),
    alternates: {
      canonical: `/category/${detail.category.slug}`
    },
    openGraph: {
      title: `${detail.category.name} timelines | TiMELiNES`,
      description: getCategoryIntro(detail.category.slug, detail.category.name),
      url: buildPublicUrl(`/category/${detail.category.slug}`),
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: `${detail.category.name} timelines | TiMELiNES`,
      description: getCategoryIntro(detail.category.slug, detail.category.name)
    }
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await contentService.getCategoryDetail(slug);
  if (!detail) {
    notFound();
  }

  const categoryJsonLd = buildCategoryJsonLd(detail);

  return (
    <div className="content-grid">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: sanitizeJsonLd(categoryJsonLd) }}
      />
      <GlassPanel>
        <span className="eyebrow">Category archive</span>
        <h1 className="page-title" style={{ fontFamily: "var(--font-serif)" }}>{detail.category.name}</h1>
        <p className="section-copy">{getCategoryIntro(detail.category.slug, detail.category.name)}</p>
      </GlassPanel>
      <section className="card-grid" aria-label={`${detail.category.name} timelines`} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {detail.timelines.map((timeline) => (
          <TimelineSummaryCard key={timeline.id} timeline={timeline} />
        ))}
      </section>
    </div>
  );
}
