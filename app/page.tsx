import { Fragment } from "react";
import { SearchBar } from "@/components/forms/SearchBar";
import { AdSlot } from "@/components/timeline/AdSlot";
import { RequestTimelineForm } from "@/components/ui/RequestTimelineForm";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { mockFeaturedTimelines } from "@/src/lib/mock-timelines";
import { adsService } from "@/src/server/services/ads-service";

export const revalidate = 3600;

export default async function HomePage() {
  const [homeFeedAd] = await adsService.getPublicAssignments(["home_feed_ad"]);

  return (
    <div className="home-shell">
      <section className="home-search-strip" aria-label="Search timelines">
        <SearchBar
          className="home-search-form home-search-form-solo"
          placeholder="timeline of.."
          inputId="home-timeline-search"
        />
      </section>

      <section id="request-timeline" className="home-request-strip">
        <RequestTimelineForm triggerLabel="MISSING A TOPIC?" variant="modal" />
      </section>

      <h2 className="featured-title">FEATURED TIMELINES</h2>

      <section className="timeline-summary-list" aria-label="Featured timelines">
        {mockFeaturedTimelines.map((timeline, index) => (
          <Fragment key={timeline.id}>
            <TimelineSummaryCard timeline={timeline} />
            {index === 1 && homeFeedAd ? <AdSlot assignment={homeFeedAd} className="home-feed-ad" /> : null}
          </Fragment>
        ))}
      </section>
    </div>
  );
}
