import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { buildMilestonePageMetadata } from "@/src/lib/social-metadata";
import { buildMilestoneJsonLd, sanitizeJsonLd } from "@/src/lib/timeline-jsonld";
import { buildMilestonePath, buildMilestoneSlug, buildTimelinePath, parseMilestoneIdParam } from "@/src/lib/share";
import { formatDisplayDate } from "@/src/lib/utils";
import { contentService } from "@/src/server/services/content-service";
import { HistoricalContextSection } from "@/components/timeline/HistoricalContextSection";

export const revalidate = 3600;

type MilestonePageParams = {
  id: string;
  slug: string;
};

async function resolveMilestone(params: Promise<MilestonePageParams>) {
  const { id, slug } = await params;
  const milestoneId = parseMilestoneIdParam(id);
  if (milestoneId === null) {
    return { milestone: null, context: null, slug };
  }

  const [milestone, context] = await Promise.all([
    contentService.getMilestone(milestoneId),
    contentService.getMilestoneContext(milestoneId)
  ]);

  return {
    milestone,
    context,
    slug
  };
}

export async function generateMetadata({ params }: { params: Promise<MilestonePageParams> }): Promise<Metadata> {
  const { milestone } = await resolveMilestone(params);
  if (!milestone) {
    return {
      title: "Milestone not found",
      alternates: {
        canonical: "/"
      }
    };
  }

  return buildMilestonePageMetadata(milestone);
}

export default async function MilestonePage({ params }: { params: Promise<MilestonePageParams> }) {
  const { milestone, context, slug } = await resolveMilestone(params);
  if (!milestone) {
    notFound();
  }

  const canonicalSlug = buildMilestoneSlug(milestone.title);
  if (slug !== canonicalSlug) {
    permanentRedirect(buildMilestonePath(milestone.id, milestone.title));
  }

  const displayDate = formatDisplayDate(milestone.date, milestone.datePrecision, {
    displayDate: milestone.displayDate,
    sortYear: milestone.sortYear,
    sortMonth: milestone.sortMonth,
    sortDay: milestone.sortDay
  });
  const timelineLinks = milestone.timelineLinks || [];
  const milestoneJsonLd = buildMilestoneJsonLd(milestone);

  return (
    <div className="content-grid">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: sanitizeJsonLd(milestoneJsonLd) }}
      />
      <section className="timeline-detail-shell">
        <div className="timeline-hero glass">
          <div className="timeline-hero-copy">
            <Link href="/" className="eyebrow">
              TiMELiNES
            </Link>
            <p className="eyebrow">{displayDate}</p>
            <h1>{milestone.title}</h1>
            <p>{milestone.description}</p>
            <div className="timeline-meta-row">
              <span>Canonical milestone</span>
              {milestone.location ? <span>{milestone.location}</span> : null}
              <span>{timelineLinks.length} timeline{timelineLinks.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        <HistoricalContextSection context={context || undefined} />

        <section className="timeline-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Context</p>
              <h2>Appears In</h2>
            </div>
          </div>
          <div className="timeline-card-grid">
            {timelineLinks.length > 0 ? (
              timelineLinks.map((timeline) => (
                <Link key={timeline.timelineId} href={buildTimelinePath(timeline.slug)} className="timeline-card glass">
                  <span className="eyebrow">Timeline</span>
                  <strong>{timeline.title}</strong>
                  <p>Position {timeline.eventOrder}</p>
                </Link>
              ))
            ) : (
              <p className="muted">No public timeline currently references this milestone.</p>
            )}
          </div>
        </section>

        <section className="timeline-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Authority</p>
              <h2>Sources</h2>
            </div>
          </div>
          <div className="sheet-link-list">
            {milestone.sources.length > 0 ? (
              milestone.sources.map((source) => (
                <a key={source.id} href={source.url} target="_blank" rel="noreferrer noopener" className="sheet-link">
                  <span>{source.publisher}</span>
                  <span>Confidence {Math.round(source.credibilityScore * 100)}%</span>
                </a>
              ))
            ) : (
              <p className="muted">No source links were attached to this milestone.</p>
            )}
          </div>
        </section>

        <section className="timeline-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Taxonomy</p>
              <h2>Tags</h2>
            </div>
          </div>
          <div className="sheet-tag-list">
            {milestone.tags.length > 0 ? (
              milestone.tags.map((tag) => (
                <Link key={tag.id} href={`/tag/${tag.slug}`} className="pill">
                  {tag.name}
                </Link>
              ))
            ) : (
              <p className="muted">No contextual tags were attached to this milestone.</p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
