import { GlassPanel } from "@/components/ui/GlassPanel";
import { RequestTimelineForm } from "@/components/ui/RequestTimelineForm";
import { TimelineSummaryCard } from "@/components/timeline/TimelineSummaryCard";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

export default async function HomePage() {
  const timelines = await contentService.listFeaturedTimelines(6);

  return (
    <div className="content-grid">
      <section className="hero-grid">
        <GlassPanel>
          <span className="eyebrow">Phase 1</span>
          <h1 className="hero-title" style={{ fontFamily: "var(--font-serif)" }}>
            Chronology engineered for clarity.
          </h1>
          <p className="lede">
            TiMELiNES turns dense history into structured, source-aware vertical timelines with fast search, editorial tooling, and SEO-ready rendering.
          </p>
          <div className="stats-row" style={{ marginTop: 24 }}>
            <div className="glass-card">
              <strong>50-200</strong>
              <p className="muted">Curated timelines in scope for Phase 1</p>
            </div>
            <div className="glass-card">
              <strong>20-300</strong>
              <p className="muted">Events per timeline supported by the rendering engine</p>
            </div>
            <div className="glass-card">
              <strong>ISR</strong>
              <p className="muted">Static-first delivery with controlled revalidation</p>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel>
          <span className="eyebrow">Missing a topic?</span>
          <h2 style={{ marginBottom: 8, fontFamily: "var(--font-serif)", fontSize: "2rem" }}>Request a timeline</h2>
          <p className="section-copy">
            Requests are rate-limited to 3 per IP per day and land in the admin queue for editorial review.
          </p>
          <RequestTimelineForm />
        </GlassPanel>
      </section>

      <GlassPanel>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <span className="eyebrow">Featured timelines</span>
            <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-serif)", fontSize: "2rem" }}>Curated chronology catalog</h2>
          </div>
          <a href="/search" className="pill">Browse full search</a>
        </div>
      </GlassPanel>

      <section className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {timelines.map((timeline) => (
          <TimelineSummaryCard key={timeline.id} timeline={timeline} />
        ))}
      </section>
    </div>
  );
}
