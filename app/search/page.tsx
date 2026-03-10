import { SearchBar } from "@/components/forms/SearchBar";
import { AdSlot } from "@/components/timeline/AdSlot";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { adsService } from "@/src/server/services/ads-service";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [result, [searchBottomAd]] = await Promise.all([
    q ? contentService.searchTimelines(q, 20) : Promise.resolve({ query: "", total: 0, items: [] }),
    adsService.getPublicAssignments(["search_bottom"])
  ]);

  return (
    <div className="content-grid">
      <GlassPanel>
        <span className="eyebrow">Search</span>
        <h1 className="page-title" style={{ fontFamily: "var(--font-serif)" }}>Find timelines</h1>
        <p className="section-copy">Search returns timelines only, ranked by title, tags, and matching event content.</p>
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
        {result.items.map((timeline) => (
          <TimelineSummaryCard key={timeline.id} timeline={timeline} />
        ))}
        {searchBottomAd ? <AdSlot assignment={searchBottomAd} className="search-bottom-ad" /> : null}
      </section>
    </div>
  );
}
