import type { Metadata } from "next";
import { SearchBar } from "@/components/forms/SearchBar";
import { HomeTimelineFeed } from "@/components/timeline/HomeTimelineFeed";
import { RequestTimelineForm } from "@/components/ui/RequestTimelineForm";
import { adsService } from "@/src/server/services/ads-service";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: {
    canonical: "/"
  }
};

export default async function HomePage() {
  const [homeFeedAd, homepageSnapshot] = await Promise.all([
    adsService.getPublicAssignments(["home_feed_ad"]).then((assignments) => assignments[0] ?? null),
    contentService.getHomepageSnapshotSlice(0, 12)
  ]);
  const activeHomeFeedAd = homeFeedAd?.activeCampaign ? homeFeedAd : null;

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

      <HomeTimelineFeed
        initialItems={homepageSnapshot.items}
        initialNextOffset={homepageSnapshot.nextOffset}
        initialHasMore={homepageSnapshot.hasMore}
        snapshotDate={homepageSnapshot.snapshotDate}
        homeFeedAd={activeHomeFeedAd}
      />
    </div>
  );
}
