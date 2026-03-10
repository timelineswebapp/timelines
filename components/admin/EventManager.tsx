"use client";

import Link from "next/link";
import { useState } from "react";
import type { EventRecord, TimelineSummary } from "@/src/lib/types";
import { initialEventDraft, parseIdList, type EventDraft } from "@/components/admin/admin-shared";

export function EventManager({
  timelines,
  events,
  onSubmit,
  onDelete
}: {
  timelines: TimelineSummary[];
  events: EventRecord[];
  onSubmit: (draft: EventDraft) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<EventDraft>(initialEventDraft);

  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Event management</h2>
      <p className="muted">
        Events remain the canonical unit. Each write still uses the existing CRUD endpoints, while timeline links remain controlled through <code>timeline_events</code>.
      </p>

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(draft).then((saved) => {
            if (saved) {
              setDraft(initialEventDraft);
            }
          });
        }}
      >
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <select className="select" value={draft.timelineId} onChange={(event) => setDraft((current) => ({ ...current, timelineId: event.target.value }))} required>
            <option value="">Choose timeline</option>
            {timelines.map((timeline) => (
              <option key={timeline.id} value={timeline.id}>
                {timeline.title}
              </option>
            ))}
          </select>
          <input className="input" type="number" min={1} value={draft.eventOrder} onChange={(event) => setDraft((current) => ({ ...current, eventOrder: event.target.value }))} required />
          <input className="input" type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} required />
          <select className="select" value={draft.datePrecision} onChange={(event) => setDraft((current) => ({ ...current, datePrecision: event.target.value as EventRecord["datePrecision"] }))}>
            <option value="day">Day</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
            <option value="approximate">Approximate</option>
          </select>
          <input className="input" type="number" min={1} max={5} value={draft.importance} onChange={(event) => setDraft((current) => ({ ...current, importance: event.target.value }))} required />
          <input className="input" value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Location" />
        </div>
        <input className="input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Event title" required />
        <textarea className="textarea" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Event description" required />
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <input className="input" value={draft.imageUrl} onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="Image URL" />
          <input className="input" value={draft.sourceIds} onChange={(event) => setDraft((current) => ({ ...current, sourceIds: event.target.value }))} placeholder="Source IDs e.g. 1,2" />
          <input className="input" value={draft.tagIds} onChange={(event) => setDraft((current) => ({ ...current, tagIds: event.target.value }))} placeholder="Tag IDs e.g. 1,3" />
        </div>
        <div className="pill-row">
          <button className="button" type="submit">
            {draft.id ? "Update event" : "Create event"}
          </button>
          {draft.id ? (
            <button type="button" className="button secondary" onClick={() => setDraft(initialEventDraft)}>
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <div className="admin-lists">
        {events.slice(0, 30).map((event) => {
          const parentTimeline = event.timelineLinks?.[0] || null;
          return (
            <article key={event.id} className="glass-card stack">
              <strong>{event.title}</strong>
              <p className="small muted" style={{ margin: 0 }}>
                {event.date} • importance {event.importance}
              </p>
              <p className="small muted" style={{ margin: 0 }}>
                {parentTimeline ? `Parent timeline: ${parentTimeline.title} · order ${parentTimeline.eventOrder}` : "No timeline link available"}
              </p>
              <div className="pill-row">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() =>
                    setDraft({
                      id: event.id,
                      timelineId: String(parentTimeline?.timelineId || ""),
                      eventOrder: String(parentTimeline?.eventOrder || 1),
                      date: event.date,
                      datePrecision: event.datePrecision,
                      title: event.title,
                      description: event.description,
                      importance: String(event.importance),
                      location: event.location || "",
                      imageUrl: event.imageUrl || "",
                      sourceIds: parseIdList(event.sources.map((source) => source.id).join(",")).join(","),
                      tagIds: parseIdList(event.tags.map((tag) => tag.id).join(",")).join(",")
                    })
                  }
                >
                  Edit
                </button>
                {parentTimeline ? (
                  <Link className="button secondary" href={`/timeline/${parentTimeline.slug}`} target="_blank">
                    Open timeline
                  </Link>
                ) : null}
                <button className="button danger" type="button" onClick={() => void onDelete(event.id)}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
