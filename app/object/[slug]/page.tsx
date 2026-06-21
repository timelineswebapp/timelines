import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMilestonePath, buildTimelinePath } from "@/src/lib/share";
import { formatDisplayDate } from "@/src/lib/utils";
import { contentService } from "@/src/server/services/content-service";

export const revalidate = 3600;

type HistoricalObjectPageParams = {
  slug: string;
};

const typeLabels = {
  person: "Person",
  institution: "Institution",
  place: "Place",
  technology: "Technology",
  publication: "Publication",
  conflict: "Conflict",
  movement: "Movement",
  period: "Period"
};

export default async function HistoricalObjectPage({ params }: { params: Promise<HistoricalObjectPageParams> }) {
  const { slug } = await params;
  const detail = await contentService.getHistoricalObjectBySlug(slug);
  if (!detail) {
    notFound();
  }

  return (
    <div className="content-grid">
      <section className="timeline-detail-shell historical-object-page">
        <div className="timeline-hero glass">
          <div className="timeline-hero-copy">
            <Link href="/" className="eyebrow">
              TiMELiNES
            </Link>
            <p className="eyebrow">{typeLabels[detail.object.primaryType]}</p>
            <h1>{detail.object.canonicalName}</h1>
            <p>{detail.object.description || "Referenced historical context in TiMELiNES milestones."}</p>
          </div>
        </div>

        <section className="timeline-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Identity</p>
              <h2>Authority</h2>
            </div>
          </div>
          <div className="historical-object-identity">
            <span>{typeLabels[detail.object.primaryType]}</span>
            <span>{detail.object.canonicalSlug}</span>
          </div>
        </section>

        <section className="timeline-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Summary</p>
              <h2>Context Role</h2>
            </div>
          </div>
          <p className="timeline-description">{detail.object.description || "This object appears through milestone participation records."}</p>
        </section>

        <section className="timeline-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Participation</p>
              <h2>Milestone History</h2>
            </div>
          </div>
          <div className="historical-object-history">
            {detail.participationHistory.length > 0 ? (
              detail.participationHistory.map((participation) => (
                <Link
                  key={participation.participationId}
                  href={buildMilestonePath(participation.milestoneId, participation.milestoneTitle)}
                  className="historical-object-history-item glass"
                >
                  <span className="eyebrow">
                    {formatDisplayDate(participation.milestoneDate, participation.milestoneDatePrecision, {
                      displayDate: participation.milestoneDisplayDate,
                      sortYear: participation.milestoneSortYear,
                      sortMonth: participation.milestoneSortMonth,
                      sortDay: participation.milestoneSortDay
                    })}
                  </span>
                  <strong>{participation.milestoneTitle}</strong>
                  <span>{participation.role}</span>
                  <p>{participation.meaning}</p>
                </Link>
              ))
            ) : (
              <p className="muted">No public milestones currently reference this object.</p>
            )}
          </div>
        </section>

        <section className="timeline-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Milestones</p>
              <h2>Related Milestones</h2>
            </div>
          </div>
          <div className="historical-object-history">
            {detail.relatedMilestones.length > 0 ? (
              detail.relatedMilestones.map((milestone) => (
                <Link
                  key={milestone.milestoneId}
                  href={buildMilestonePath(milestone.milestoneId, milestone.title)}
                  className="historical-object-history-item glass"
                >
                  <span className="eyebrow">
                    {formatDisplayDate(milestone.date, milestone.datePrecision, {
                      displayDate: milestone.displayDate,
                      sortYear: milestone.sortYear,
                      sortMonth: milestone.sortMonth,
                      sortDay: milestone.sortDay
                    })}
                  </span>
                  <strong>{milestone.title}</strong>
                  <p>{milestone.description}</p>
                </Link>
              ))
            ) : (
              <p className="muted">No public milestones currently reference this object.</p>
            )}
          </div>
        </section>

        <section className="timeline-section">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Timelines</p>
              <h2>Related Timelines</h2>
            </div>
          </div>
          <div className="timeline-card-grid">
            {detail.relatedTimelines.length > 0 ? (
              detail.relatedTimelines.map((timeline) => (
                <Link key={timeline.timelineId} href={buildTimelinePath(timeline.slug)} className="timeline-card glass">
                  <span className="eyebrow">Timeline</span>
                  <strong>{timeline.title}</strong>
                  <p>{timeline.participationCount} milestone{timeline.participationCount === 1 ? "" : "s"}</p>
                </Link>
              ))
            ) : (
              <p className="muted">No public timelines currently reference this object.</p>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
