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
        <span className="eyebrow">Explore by time</span>
        <h1 className="hero-title" style={{ fontFamily: "var(--font-serif)" }}>
          Search timelines
        </h1>
        <p className="lede">
          History should be explored through time, not through articles. Search directly for the subject you want to follow.
        </p>
        <SearchBar
          className="home-search-form"
          placeholder="Search timelines"
          buttonLabel="Open"
          inputId="home-timeline-search"
        />
        <a href="#request-timeline" className="button secondary home-request-action">
          Request a timeline
        </a>
      </GlassPanel>

      <GlassPanel className="home-featured-panel">
        <div className="home-section-heading">
          <span className="eyebrow">Featured timelines</span>
          <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-serif)", fontSize: "2rem" }}>
            Start with a chronology
          </h2>
        </div>
      </GlassPanel>

      <section className="timeline-summary-list" aria-label="Featured timelines">
        {timelines.map((timeline) => (
          <TimelineSummaryCard key={timeline.id} timeline={timeline} />
        ))}
      </section>

      <GlassPanel className="home-request-panel">
        <div id="request-timeline" className="stack">
          <div className="home-section-heading">
            <span className="eyebrow">Missing a topic?</span>
            <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-serif)", fontSize: "2rem" }}>
              Request a timeline
            </h2>
          </div>
          <p className="section-copy" style={{ margin: 0 }}>
            Requests are rate-limited to 3 per IP per day and enter the editorial queue without leaving the homepage.
          </p>
          <RequestTimelineForm />
        </div>
      </GlassPanel>
    </div>
  );
}
