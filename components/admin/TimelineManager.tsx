"use client";

import Link from "next/link";
import { useState } from "react";
import type { TimelineSummary } from "@/src/lib/types";
import { initialTimelineDraft, type TimelineDraft } from "@/components/admin/admin-shared";

export function TimelineManager({
  timelines,
  onSubmit,
  onDelete
}: {
  timelines: TimelineSummary[];
  onSubmit: (draft: TimelineDraft) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<TimelineDraft>(initialTimelineDraft);

  return (
    <section className="glass section-card stack">
      <div className="admin-split">
        <div>
          <h2 style={{ marginTop: 0 }}>Timeline management</h2>
          <p className="muted">Create, edit, delete, or open a timeline without changing the existing API contract.</p>
        </div>
      </div>

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(draft).then((saved) => {
            if (saved) {
              setDraft(initialTimelineDraft);
            }
          });
        }}
      >
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <input className="input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Timeline title" required />
          <input className="input" value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="timeline-slug" required />
          <input className="input" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Category" required />
          <button className="button" type="submit">
            {draft.id ? "Update timeline" : "Create timeline"}
          </button>
        </div>
        <textarea className="textarea" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" required />
        {draft.id ? (
          <button type="button" className="button secondary" onClick={() => setDraft(initialTimelineDraft)}>
            Cancel edit
          </button>
        ) : null}
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Timeline</th>
            <th>Category</th>
            <th>Events</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {timelines.map((timeline) => (
            <tr key={timeline.id}>
              <td>
                <strong>{timeline.title}</strong>
                <div className="small muted">{timeline.slug}</div>
              </td>
              <td>{timeline.category}</td>
              <td>{timeline.eventCount}</td>
              <td>
                <div className="pill-row">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: timeline.id,
                        title: timeline.title,
                        slug: timeline.slug,
                        description: timeline.description,
                        category: timeline.category
                      })
                    }
                  >
                    Edit
                  </button>
                  <Link className="button secondary" href={`/timeline/${timeline.slug}`} target="_blank">
                    View
                  </Link>
                  <button className="button danger" type="button" onClick={() => void onDelete(timeline.id)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
