import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/forms/SearchBar";
import { HomeTimelineFeed } from "@/components/timeline/HomeTimelineFeed";
import { RequestTimelineForm } from "@/components/ui/RequestTimelineForm";
import { adsService } from "@/src/server/services/ads-service";
import { buildHomePageJsonLd, sanitizeJsonLd } from "@/src/lib/timeline-jsonld";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "TiMELiNES | Structured timelines of history, science, technology, and culture",
  description: "TiMELiNES publishes structured timelines of major events, dates, and milestones across history, science, technology, culture, and society.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "TiMELiNES | Structured timelines of history, science, technology, and culture",
    description: "TiMELiNES publishes structured timelines of major events, dates, and milestones across history, science, technology, culture, and society.",
    url: "https://www.timelines.sbs/",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "TiMELiNES | Structured timelines of history, science, technology, and culture",
    description: "TiMELiNES publishes structured timelines of major events, dates, and milestones across history, science, technology, culture, and society."
  }
};

export default async function HomePage() {
  const [homeFeedAd, homepageSnapshot, categoryEntries] = await Promise.all([
    adsService.getPublicAssignments(["home_feed_ad"]).then((assignments) => assignments[0] ?? null),
    contentService.getHomepageSnapshotSlice(0, 12),
    contentService.listCategoryEntries()
  ]);
  const activeHomeFeedAd = homeFeedAd?.activeCampaign ? homeFeedAd : null;
  const homepageJsonLd = buildHomePageJsonLd();

  return (
    <div className="home-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: sanitizeJsonLd(homepageJsonLd) }}
      />
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

      <section className="glass section-card home-seo-intro" aria-label="About TiMELiNES">
        <p className="home-seo-copy">
          TiMELiNES is a structured timeline library for major historical subjects, scientific breakthroughs, infrastructure shifts, and cultural change. Each page organizes pivotal dates, events, and milestones into a readable chronological record.
        </p>
        <div className="home-category-links" aria-label="Browse timeline categories">
          {categoryEntries.map((category) => (
            <Link key={category.slug} href={`/category/${category.slug}`} className="pill home-category-link">
              {category.name} timelines
            </Link>
          ))}
        </div>
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
