"use client";

import { useRef, useState } from "react";
import type {
  ImportExecutionResult,
  ImportPreview,
  ImportType,
  TimelineSummary
} from "@/src/lib/types";

const DEFAULT_IMPORT_CONTENT = `{
  "timeline": {
    "title": "Sample timeline",
    "description": "Structured timeline import payload with events.",
    "category": "History"
  },
  "events": [
    {
      "date": "2025-01",
      "title": "Sample import event",
      "description": "Structured import payload for preview and approval."
    }
  ]
}`;

export function ImportData({
  timelines,
  onPreview,
  onApprove
}: {
  timelines: TimelineSummary[];
  onPreview: (input: {
    format: "json" | "csv" | "text";
    importType: ImportType;
    timelineId?: number | null;
    content: string;
    skipDuplicates: boolean;
  }) => Promise<ImportPreview>;
  onApprove: (input: {
    format: "json" | "csv" | "text";
    importType: ImportType;
    timelineId?: number | null;
    content: string;
    skipDuplicates: boolean;
  }) => Promise<ImportExecutionResult>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [format, setFormat] = useState<"json" | "csv" | "text">("json");
  const [importType, setImportType] = useState<ImportType>("timeline_with_events");
  const [timelineId, setTimelineId] = useState("");
  const [content, setContent] = useState(DEFAULT_IMPORT_CONTENT);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportExecutionResult | null>(null);

  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Import data</h2>
      <p className="muted">Upload structured timeline data or import events into an existing timeline through the same preview and approval flow.</p>

      <div className="form-grid" style={{ gridTemplateColumns: "180px 1fr" }}>
        <select className="select" value={format} onChange={(event) => setFormat(event.target.value as "json" | "csv" | "text")}>
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="text">Text</option>
        </select>
        <select className="select" value={importType} onChange={(event) => setImportType(event.target.value as ImportType)}>
          <option value="timeline_with_events">Timeline with events</option>
          <option value="events_into_existing_timeline">Events into existing timeline</option>
        </select>
      </div>

      {importType === "events_into_existing_timeline" ? (
        <select className="select" value={timelineId} onChange={(event) => setTimelineId(event.target.value)} required>
          <option value="">Choose timeline</option>
          {timelines.map((timeline) => (
            <option key={timeline.id} value={timeline.id}>
              {timeline.title}
            </option>
          ))}
        </select>
      ) : null}

      <div className="pill-row">
        <button className="button secondary" type="button" onClick={() => fileInputRef.current?.click()}>
          Upload file
        </button>
        <label className="pill" style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(event) => setSkipDuplicates(event.target.checked)}
            style={{ marginRight: 8 }}
          />
          Skip duplicate events
        </label>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,.txt,.text"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            setContent(String(reader.result || ""));
          };
          reader.readAsText(file);
        }}
      />

      <textarea className="textarea" value={content} onChange={(event) => setContent(event.target.value)} />

      <div className="pill-row">
        <button
          className="button"
          type="button"
          onClick={() =>
            void onPreview({
              format,
              importType,
              timelineId: timelineId ? Number(timelineId) : null,
              content,
              skipDuplicates
            }).then((nextPreview) => {
              setResult(null);
              setPreview(nextPreview);
            })
          }
          disabled={importType === "events_into_existing_timeline" && !timelineId}
        >
          Preview results
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            void onApprove({
              format,
              importType,
              timelineId: timelineId ? Number(timelineId) : null,
              content,
              skipDuplicates
            }).then((nextResult) => {
              setPreview(null);
              setResult(nextResult);
            })
          }
          disabled={importType === "events_into_existing_timeline" && !timelineId}
        >
          Approve import
        </button>
      </div>

      {preview ? (
        <div className="glass-card stack">
          <strong>Preview</strong>
          <p className="muted" style={{ margin: 0 }}>
            {preview.timeline.mode === "create" ? "New timeline" : "Existing timeline"}: {preview.timeline.title}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {preview.totals.accepted} events will be inserted • {preview.totals.duplicates} duplicates detected
          </p>
          <div className="admin-lists">
            {preview.preview.map((item) => (
              <article key={`${item.date}-${item.title}`} className="glass-card stack">
                <strong>{item.title}</strong>
                <p className="small muted" style={{ margin: 0 }}>
                  {item.date} {item.duplicate ? "• duplicate" : "• new"}
                </p>
                <p className="small muted" style={{ margin: 0 }}>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="glass-card stack">
          <strong>{result.message}</strong>
          <p className="muted" style={{ margin: 0 }}>
            Timeline ID: {result.timelineId} • Events created: {result.eventsCreatedCount} • Duplicates skipped: {result.duplicatesSkipped}
          </p>
        </div>
      ) : null}
    </section>
  );
}
