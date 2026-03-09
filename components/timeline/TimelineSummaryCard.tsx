import Link from "next/link";
import type { TimelineSummary } from "@/src/lib/types";
import { truncate } from "@/src/lib/utils";

export function TimelineSummaryCard({
  timeline,
  dateRange
}: {
  timeline: TimelineSummary;
  dateRange?: string;
}) {
  const meta = [dateRange, `${timeline.eventCount} events`].filter(Boolean).join(" · ");

  return (
    <article className="timeline-summary-card glass">
      <Link href={`/timeline/${timeline.slug}`} className="timeline-summary-link">
        <span className="timeline-summary-category">{timeline.category}</span>
        <h3 className="timeline-summary-title">{timeline.title}</h3>
        <p className="timeline-summary-meta">{meta}</p>
        <p className="timeline-summary-description">{truncate(timeline.description, 110)}</p>
      </Link>
    </article>
  );
}
