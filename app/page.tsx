import { SearchBar } from "@/components/forms/SearchBar";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { RequestTimelineForm } from "@/components/ui/RequestTimelineForm";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { mockFeaturedTimelines } from "@/src/lib/mock-timelines";

export const revalidate = 3600;

export default function HomePage() {
  return (
    <div className="home-shell">
      <GlassPanel className="home-search-panel">
        <SearchBar
          className="home-search-form"
          leadingLabel="Timeline of:"
          placeholder="Search timelines"
          inputId="home-timeline-search"
        />
      </GlassPanel>

      <section id="request-timeline" className="home-request-strip">
        <RequestTimelineForm triggerLabel="MISSING A TOPIC?" variant="modal" />
      </section>

      <h2 className="featured-title">FEATURED TIMELINES</h2>

      <section className="timeline-summary-list" aria-label="Featured timelines">
        {mockFeaturedTimelines.map((timeline) => (
          <TimelineSummaryCard key={timeline.id} timeline={timeline} />
        ))}
      </section>
    </div>
  );
}
