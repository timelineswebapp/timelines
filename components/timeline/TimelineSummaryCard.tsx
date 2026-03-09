import Link from "next/link";
import type { TimelineSummary } from "@/src/lib/types";
import { truncate } from "@/src/lib/utils";
import { StatusPill } from "@/components/ui/StatusPill";

export function TimelineSummaryCard({ timeline }: { timeline: TimelineSummary }) {
  return (
    <article className="glass section-card stack">
      <div className="pill-row">
        <StatusPill>{timeline.category}</StatusPill>
        <StatusPill>{timeline.eventCount} events</StatusPill>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: "1.4rem" }}>
          <Link href={`/timeline/${timeline.slug}`}>{timeline.title}</Link>
        </h3>
        <p className="muted" style={{ margin: 0 }}>
          {truncate(timeline.description, 180)}
        </p>
      </div>
      <div className="pill-row" style={{ flexWrap: "wrap" }}>
        {timeline.tags.map((tag) => (
          <Link key={tag.id} href={`/tag/${tag.slug}`} className="pill">
            {tag.name}
          </Link>
        ))}
      </div>
    </article>
  );
}
