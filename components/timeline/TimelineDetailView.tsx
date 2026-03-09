import Link from "next/link";
import type { TimelineDetail } from "@/src/lib/types";
import { formatDisplayDate } from "@/src/lib/utils";
import { AdSlot } from "@/components/timeline/AdSlot";
import { StatusPill } from "@/components/ui/StatusPill";

export function TimelineDetailView({ timeline }: { timeline: TimelineDetail }) {
  const midIndex = Math.max(1, Math.floor(timeline.events.length / 2));

  return (
    <div className="content-grid">
      <section className="glass section-card">
        <span className="eyebrow">{timeline.category}</span>
        <h1 className="page-title">{timeline.title}</h1>
        <p className="lede">{timeline.description}</p>
        <div className="timeline-meta" style={{ marginTop: 18 }}>
          <StatusPill>{timeline.eventCount} events</StatusPill>
          {timeline.tags.map((tag) => (
            <Link href={`/tag/${tag.slug}`} key={tag.id} className="pill">
              {tag.name}
            </Link>
          ))}
        </div>
      </section>

      <AdSlot label="After intro" />

      <section className="timeline-shell">
        {timeline.events.map((event, index) => (
          <article key={event.id} className="event-card">
            <details className="glass section-card event-details" open={index < 2}>
              <summary className="event-summary">
                <span className="eyebrow">{formatDisplayDate(event.date, event.datePrecision)}</span>
                <h3>{event.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {event.description}
                </p>
              </summary>
              <div className="event-body stack">
                <div className="pill-row" style={{ flexWrap: "wrap" }}>
                  <StatusPill>Importance {event.importance}/5</StatusPill>
                  {event.location ? <StatusPill>{event.location}</StatusPill> : null}
                  {event.tags.map((tag) => (
                    <Link href={`/tag/${tag.slug}`} key={tag.id} className="pill">
                      {tag.name}
                    </Link>
                  ))}
                </div>
                <div className="stack" style={{ gap: 10 }}>
                  <strong>Sources</strong>
                  {event.sources.map((source) => (
                    <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="pill">
                      {source.publisher} ({Math.round(source.credibilityScore * 100)}%)
                    </a>
                  ))}
                </div>
              </div>
            </details>
            {index === midIndex ? <AdSlot label="Mid timeline" /> : null}
          </article>
        ))}
      </section>

      <AdSlot label="End of timeline" />

      <section className="card-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <article className="glass section-card stack">
          <strong>Source integrity</strong>
          <p className="muted" style={{ margin: 0 }}>
            Every event carries attached source references so editorial review stays tied to evidence, not UI state.
          </p>
        </article>
        <article className="glass section-card stack">
          <strong>Related timelines</strong>
          {timeline.relatedTimelines.length > 0 ? (
            timeline.relatedTimelines.map((item) => (
              <Link key={item.id} href={`/timeline/${item.slug}`} className="pill">
                {item.title}
              </Link>
            ))
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              More related timelines will appear as the catalog expands.
            </p>
          )}
        </article>
      </section>
    </div>
  );
}
