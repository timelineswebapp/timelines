import { SearchBar } from "@/components/forms/SearchBar";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { RequestTimelineForm } from "@/components/ui/RequestTimelineForm";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

export default async function HomePage() {
  const timelines = await contentService.listFeaturedTimelines(6);
  const placeholderTopics = [
    "Roman Empire",
    "Cold War",
    "History of Medicine",
    "Silk Road",
    "Ancient Egypt"
  ];

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
        <RequestTimelineForm collapsible triggerLabel="MISSING A TOPIC?" />
      </section>

      <h2 className="featured-title">FEATURED TIMELINES</h2>

      <section className="timeline-summary-list" aria-label="Featured timelines">
        {timelines.map((timeline) => (
          <TimelineSummaryCard key={timeline.id} timeline={timeline} />
        ))}
        {placeholderTopics.map((topic) => (
          <article key={topic} className="timeline-placeholder-card">
            <span>{topic}</span>
            <span className="timeline-placeholder-status">placeholder</span>
          </article>
        ))}
      </section>
    </div>
  );
}
