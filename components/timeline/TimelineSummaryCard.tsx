import Link from "next/link";
import { TimelineShareButton } from "@/components/timeline/TimelineShareButton";
import type { TimelineSummary } from "@/src/lib/types";
import { truncate } from "@/src/lib/utils";

export function TimelineSummaryCard({
  timeline,
  dateRange,
  showShareAction = false
}: {
  timeline: TimelineSummary;
  dateRange?: string;
  showShareAction?: boolean;
}) {
  const meta = [dateRange, `${timeline.eventCount} events`].filter(Boolean).join(" · ");

  return (
    <article className="timeline-summary-card glass">
      {showShareAction ? <TimelineShareButton slug={timeline.slug} title={timeline.title} /> : null}
      <Link href={`/timeline/${timeline.slug}`} className="timeline-summary-link">
        <div className="timeline-summary-head">
          <span className="timeline-summary-category">{timeline.category}</span>
          {showShareAction ? <span className="timeline-summary-share-slot" aria-hidden="true" /> : null}
        </div>
        <h3 className="timeline-summary-title">{timeline.title}</h3>
        <p className="timeline-summary-meta">{meta}</p>
        <p className="timeline-summary-description">{truncate(timeline.description, 110)}</p>
      </Link>
    </article>
  );
}
