"use client";

import { useState } from "react";
import type { ImportExecutionResult, ImportPreview, TimelineSummary } from "@/src/lib/types";

const DEFAULT_IMPORT_CONTENT = `[
  {
    "date": "2025-01-01",
    "datePrecision": "day",
    "title": "Sample import event",
    "description": "Structured import payload for preview and approval.",
    "importance": 3
  }
]`;

export function ImportEvents({
  timelines,
  onPreview,
  onApprove
}: {
  timelines: TimelineSummary[];
  onPreview: (input: { format: "json" | "csv"; timelineId: number; content: string }) => Promise<ImportPreview>;
  onApprove: (input: { format: "json" | "csv"; timelineId: number; content: string }) => Promise<ImportExecutionResult>;
}) {
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [timelineId, setTimelineId] = useState("");
  const [content, setContent] = useState(DEFAULT_IMPORT_CONTENT);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Import events</h2>
      <p className="muted">Upload structured text, preview duplicates, then approve insertion into the selected timeline.</p>
      <div className="form-grid" style={{ gridTemplateColumns: "180px 1fr" }}>
        <select className="select" value={format} onChange={(event) => setFormat(event.target.value as "json" | "csv")}>
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
        <select className="select" value={timelineId} onChange={(event) => setTimelineId(event.target.value)} required>
          <option value="">Choose timeline</option>
          {timelines.map((timeline) => (
            <option key={timeline.id} value={timeline.id}>
              {timeline.title}
            </option>
          ))}
        </select>
      </div>
      <textarea className="textarea" value={content} onChange={(event) => setContent(event.target.value)} />
      <div className="pill-row">
        <button
          className="button"
          type="button"
          onClick={() =>
            void onPreview({
              format,
              timelineId: Number(timelineId),
              content
            }).then((result) => setPreview(result))
          }
          disabled={!timelineId}
        >
          Preview results
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            void onApprove({
              format,
              timelineId: Number(timelineId),
              content
            }).then(() => setPreview(null))
          }
          disabled={!timelineId}
        >
          Approve import
        </button>
      </div>
      {preview ? (
        <div className="glass-card stack">
          <strong>Preview</strong>
          <p className="muted" style={{ margin: 0 }}>
            {preview.totals.accepted} accepted • {preview.totals.duplicates} duplicates • {preview.totals.rows} rows
          </p>
          <div className="admin-lists">
            {preview.preview.map((item) => (
              <article key={`${item.date}-${item.title}`} className="glass-card stack">
                <strong>{item.title}</strong>
                <p className="small muted" style={{ margin: 0 }}>{item.date}</p>
                <p className="small muted" style={{ margin: 0 }}>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
