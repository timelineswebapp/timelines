import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/forms/SearchBar";
import { AdSlot } from "@/components/timeline/AdSlot";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { buildPublicUrl } from "@/src/lib/public-site";
import { buildMilestonePath } from "@/src/lib/share";
import type { MilestoneSearchSummary, SearchResultItem } from "@/src/lib/types";
import { formatDisplayDate, truncate } from "@/src/lib/utils";
import { adsService } from "@/src/server/services/ads-service";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

function MilestoneSearchCard({ milestone }: { milestone: MilestoneSearchSummary }) {
  const displayDate = formatDisplayDate(milestone.date, milestone.datePrecision, {
    displayDate: milestone.displayDate,
    sortYear: milestone.sortYear,
    sortMonth: milestone.sortMonth,
    sortDay: milestone.sortDay
  });
  const primaryTimeline = milestone.timelineLinks[0];
  const meta = [
    displayDate,
    milestone.location,
    primaryTimeline ? `Appears in ${primaryTimeline.title}` : null,
    milestone.sources.length > 0 ? `${milestone.sources.length} source${milestone.sources.length === 1 ? "" : "s"}` : null
  ].filter(Boolean).join(" · ");

  return (
    <article className="timeline-summary-card glass">
      <Link href={buildMilestonePath(milestone.id, milestone.title)} className="timeline-summary-link">
        <div className="timeline-summary-head">
          <span className="timeline-summary-category">Milestone</span>
        </div>
        <h3 className="timeline-summary-title">{milestone.title}</h3>
        <p className="timeline-summary-meta">{meta}</p>
        <p className="timeline-summary-description">{truncate(milestone.description, 130)}</p>
      </Link>
    </article>
  );
}

function SearchResultCard({ item }: { item: SearchResultItem }) {
  if (item.type === "timeline") {
    return <TimelineSummaryCard timeline={item.timeline} />;
  }

  return <MilestoneSearchCard milestone={item.milestone} />;
}

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q = "" } = await searchParams;
  const query = q.trim();

  return {
    title: query ? `Search: ${query} | TiMELiNES` : "Search timelines | TiMELiNES",
    description: query
      ? `Search results for "${query}" across structured timelines and event chronologies.`
      : "Search structured timelines and event chronologies across the TiMELiNES catalog.",
    alternates: {
      canonical: query ? `/search?q=${encodeURIComponent(query)}` : "/search"
    },
    openGraph: {
      title: query ? `Search: ${query} | TiMELiNES` : "Search timelines | TiMELiNES",
      description: query
        ? `Search results for "${query}" across structured timelines and event chronologies.`
        : "Search structured timelines and event chronologies across the TiMELiNES catalog.",
      url: buildPublicUrl(query ? `/search?q=${encodeURIComponent(query)}` : "/search"),
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: query ? `Search: ${query} | TiMELiNES` : "Search timelines | TiMELiNES",
      description: query
        ? `Search results for "${query}" across structured timelines and event chronologies.`
        : "Search structured timelines and event chronologies across the TiMELiNES catalog."
    }
  };
}

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [result, [searchBottomAd]] = await Promise.all([
    q ? contentService.searchKnowledge(q, 20) : Promise.resolve({ query: "", total: 0, items: [] }),
    adsService.getPublicAssignments(["search_bottom"])
  ]);
  const activeSearchBottomAd = searchBottomAd?.activeCampaign ? searchBottomAd : null;

  return (
    <div className="content-grid">
      <GlassPanel>
        <span className="eyebrow">Search</span>
        <h1 className="page-title" style={{ fontFamily: "var(--font-serif)" }}>Find timelines and milestones</h1>
        <p className="section-copy">Search returns timelines and canonical milestones, ranked by title, tags, and event content.</p>
        <div style={{ marginTop: 18 }}>
          <SearchBar defaultValue={q} />
        </div>
      </GlassPanel>

      {q ? (
        <GlassPanel>
          <strong>{result.total}</strong>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Results for “{result.query}”
          </p>
        </GlassPanel>
      ) : null}

      <section className="search-results">
        {result.items.map((item) => (
          <SearchResultCard key={`${item.type}-${item.id}`} item={item} />
        ))}
        {activeSearchBottomAd ? <AdSlot assignment={activeSearchBottomAd} className="search-bottom-ad" /> : null}
      </section>
    </div>
  );
}
