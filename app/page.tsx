import { SearchBar } from "@/components/forms/SearchBar";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { RequestTimelineForm } from "@/components/ui/RequestTimelineForm";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

export default async function HomePage() {
  const timelines = await contentService.listFeaturedTimelines(6);

  return (
    <div className="home-shell">
      <GlassPanel className="home-search-panel">
        <SearchBar
          className="home-search-form"
          leadingLabel="Timeline of:"
          placeholder="Search timelines"
          buttonLabel="Open"
          inputId="home-timeline-search"
        />
      </GlassPanel>

      <GlassPanel className="home-request-panel">
        <div id="request-timeline" className="stack">
          <div className="home-section-heading">
            <span className="eyebrow">Missing a topic?</span>
            <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-serif)", fontSize: "2rem" }}>
              Request a timeline
            </h2>
          </div>
          <RequestTimelineForm />
        </div>
      </GlassPanel>

      <GlassPanel className="home-featured-panel">
        <div className="home-section-heading">
          <span className="eyebrow">Featured timelines</span>
        </div>
      </GlassPanel>

      <section className="timeline-summary-list" aria-label="Featured timelines">
        {timelines.map((timeline) => (
          <TimelineSummaryCard key={timeline.id} timeline={timeline} />
        ))}
      </section>
    </div>
  );
}
