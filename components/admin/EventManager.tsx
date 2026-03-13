"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EmbeddedSourceInput, EventRecord, TagRecord, TimelineSummary } from "@/src/lib/types";
import { AdminModal } from "@/components/admin/AdminModal";
import { initialEventDraft, parseIdList, type EventDraft } from "@/components/admin/admin-shared";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";

const PAGE_SIZE = 12;

function createEmptySource(): EmbeddedSourceInput {
  return {
    title: "",
    url: "",
    publisher: ""
  };
}

function mapEventToDraft(event: EventRecord): EventDraft {
  const parentTimeline = event.timelineLinks?.[0];

  return {
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
    sources: event.sources.map((source) => ({
      title: source.publisher,
      url: source.url,
      publisher: source.publisher
    })),
    tagIds: parseIdList(event.tags.map((tag) => tag.id).join(",")).join(",")
  };
}

export function EventManager({
  timelines,
  tags,
  events,
  onSubmit,
  onDelete
}: {
  timelines: TimelineSummary[];
  tags: TagRecord[];
  events: EventRecord[];
  onSubmit: (draft: EventDraft) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [timelineFilter, setTimelineFilter] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<EventDraft>(initialEventDraft);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventRecord | null>(null);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const filteredEvents = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return events.filter((event) => {
      const parentTimeline = event.timelineLinks?.[0];
      const matchesFilter = !timelineFilter || String(parentTimeline?.timelineId || "") === timelineFilter;
      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        event.title.toLowerCase().includes(query) ||
        event.date.toLowerCase().includes(query) ||
        (parentTimeline?.title.toLowerCase().includes(query) ?? false)
      );
    });
  }, [debouncedSearch, events, timelineFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const visibleEvents = filteredEvents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedTagIds = useMemo(() => new Set(parseIdList(draft.tagIds)), [draft.tagIds]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, timelineFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openCreateModal() {
    setDraft(initialEventDraft);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setDraft(initialEventDraft);
    setIsEditorOpen(false);
  }

  function updateSource(index: number, field: keyof EmbeddedSourceInput, value: string) {
    setDraft((current) => ({
      ...current,
      sources: current.sources.map((source, sourceIndex) =>
        sourceIndex === index
          ? {
              ...source,
              [field]: value
            }
          : source
      )
    }));
  }

  function removeSource(index: number) {
    setDraft((current) => ({
      ...current,
      sources: current.sources.filter((_, sourceIndex) => sourceIndex !== index)
    }));
  }

  function toggleTag(tagId: number) {
    const next = new Set(parseIdList(draft.tagIds));
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }

    setDraft((current) => ({
      ...current,
      tagIds: Array.from(next).join(",")
    }));
  }

  return (
    <section className="glass section-card stack">
      <div className="admin-manager-header admin-manager-header-tight">
        <div>
          <h2 style={{ marginTop: 0 }}>Event management</h2>
          <p className="muted">Search by title, timeline, or chronology, then create, edit, or remove events.</p>
        </div>
        <button className="button" type="button" onClick={openCreateModal}>
          Create
        </button>
      </div>

      <div className="admin-toolbar admin-toolbar-wide admin-toolbar-event">
        <input
          className="input"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search events by title, timeline, or date"
        />
        <select className="select" value={timelineFilter} onChange={(event) => setTimelineFilter(event.target.value)}>
          <option value="">All timelines</option>
          {timelines.map((timeline) => (
            <option key={timeline.id} value={timeline.id}>
              {timeline.title}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-record-list" aria-label="Events">
        {visibleEvents.map((event) => {
          const parentTimeline = event.timelineLinks?.[0] || null;

          return (
            <article key={event.id} className="admin-record-card admin-record-card-event">
              <div className="admin-record-main">
                <strong className="admin-record-title">{event.title}</strong>
                <div className="small muted admin-record-subtitle">
                  {event.description.slice(0, 120)}
                  {event.description.length > 120 ? "..." : ""}
                </div>
                <div className="admin-record-meta admin-record-meta-event">
                  <span className="admin-record-stat">
                    <span className="admin-record-stat-label">Timeline</span>
                    <span>{parentTimeline?.title || "Unlinked"}</span>
                  </span>
                  <span className="admin-record-stat">
                    <span className="admin-record-stat-label">Date</span>
                    <span>{event.date}</span>
                  </span>
                  <span className="admin-record-stat">
                    <span className="admin-record-stat-label">Sources</span>
                    <span>{event.sources.length}</span>
                  </span>
                </div>
              </div>
              <div className="admin-record-actions admin-record-actions-compact">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    setDraft(mapEventToDraft(event));
                    setIsEditorOpen(true);
                  }}
                >
                  Edit
                </button>
                {parentTimeline ? (
                  <Link className="button secondary" href={`/timeline/${parentTimeline.slug}`} target="_blank">
                    Open
                  </Link>
                ) : null}
                <button className="button danger" type="button" onClick={() => setDeleteTarget(event)}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
        {visibleEvents.length === 0 ? (
          <div className="admin-empty-state muted">No events match the current search or timeline filter.</div>
        ) : null}
      </div>

      <div className="admin-pagination">
        <button className="button secondary" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
          Previous
        </button>
        <span className="small muted">
          Page {page} of {totalPages}
        </span>
        <button className="button secondary" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
          Next
        </button>
      </div>

      <AdminModal open={isEditorOpen} title={draft.id ? "Edit event" : "Create event"} onClose={closeEditor}>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(draft).then((saved) => {
              if (saved) {
                closeEditor();
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
            <input
              className="input"
              value={draft.date}
              onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
              placeholder="1914-07-28, 1453-05, 30 CE, 44 BCE, c. 1200 BCE"
              required
            />
            <select className="select" value={draft.datePrecision} onChange={(event) => setDraft((current) => ({ ...current, datePrecision: event.target.value as EventRecord["datePrecision"] }))}>
              <option value="day">Day</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="approximate">Approximate</option>
            </select>
            <input className="input" type="number" min={1} value={draft.eventOrder} onChange={(event) => setDraft((current) => ({ ...current, eventOrder: event.target.value }))} placeholder="Order" required />
            <input className="input" type="number" min={1} max={5} value={draft.importance} onChange={(event) => setDraft((current) => ({ ...current, importance: event.target.value }))} placeholder="Importance" required />
            <input className="input" value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Location" />
          </div>

          <input className="input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Title" required />
          <textarea className="textarea" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" required />
          <input className="input" value={draft.imageUrl} onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="Image URL (optional)" />

          <div className="stack" style={{ gap: 12 }}>
            <div className="admin-manager-header">
              <strong>Sources</strong>
              <button
                className="button secondary"
                type="button"
                onClick={() => setDraft((current) => ({ ...current, sources: [...current.sources, createEmptySource()] }))}
              >
                Add source
              </button>
            </div>
            {draft.sources.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                Sources are managed inline with the event. Each source creates or reuses a record by URL.
              </p>
            ) : null}
            {draft.sources.map((source, index) => (
              <div key={`${source.url}-${index}`} className="admin-source-row">
                <input className="input" value={source.title} onChange={(event) => updateSource(index, "title", event.target.value)} placeholder="Source title" required />
                <input className="input" value={source.url} onChange={(event) => updateSource(index, "url", event.target.value)} placeholder="https://source" required />
                <input className="input" value={source.publisher || ""} onChange={(event) => updateSource(index, "publisher", event.target.value)} placeholder="Publisher (optional)" />
                <button className="button danger" type="button" onClick={() => removeSource(index)}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="stack" style={{ gap: 12 }}>
            <strong>Tags</strong>
            <div className="admin-tag-grid">
              {tags.map((tag) => (
                <label key={tag.id} className={`pill admin-tag-pill ${selectedTagIds.has(tag.id) ? "admin-tag-pill-active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selectedTagIds.has(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="sr-only"
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </div>

          <div className="admin-modal-actions">
            <button className="button secondary" type="button" onClick={closeEditor}>
              Cancel
            </button>
            <button className="button" type="submit">
              {draft.id ? "Save event" : "Create event"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal open={Boolean(deleteTarget)} title="Delete event" onClose={() => setDeleteTarget(null)} variant="confirm">
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            This will delete the event and its current timeline link.
          </p>
          <strong>{deleteTarget?.title}</strong>
          <div className="admin-modal-actions">
            <button className="button secondary" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button
              className="button danger"
              type="button"
              onClick={() => {
                if (!deleteTarget) {
                  return;
                }

                void onDelete(deleteTarget.id).then((deleted) => {
                  if (deleted) {
                    setDeleteTarget(null);
                  }
                });
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </AdminModal>
    </section>
  );
}
