"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TimelineSummary } from "@/src/lib/types";
import { AdminModal } from "@/components/admin/AdminModal";
import { initialTimelineDraft, type TimelineDraft } from "@/components/admin/admin-shared";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";

const PAGE_SIZE = 10;

export function TimelineManager({
  timelines,
  onSubmit,
  onDelete
}: {
  timelines: TimelineSummary[];
  onSubmit: (draft: TimelineDraft) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<TimelineDraft>(initialTimelineDraft);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TimelineSummary | null>(null);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const filteredTimelines = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return timelines;
    }

    return timelines.filter((timeline) =>
      timeline.title.toLowerCase().includes(query) || timeline.slug.toLowerCase().includes(query)
    );
  }, [debouncedSearch, timelines]);

  const totalPages = Math.max(1, Math.ceil(filteredTimelines.length / PAGE_SIZE));
  const visibleTimelines = filteredTimelines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const modalTitle = draft.id ? "Edit timeline" : "Create timeline";

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function closeDraftModal() {
    setDraft(initialTimelineDraft);
    setIsEditorOpen(false);
  }

  return (
    <section className="glass section-card stack">
      <div className="admin-manager-header">
        <div>
          <h2 style={{ marginTop: 0 }}>Timeline management</h2>
          <p className="muted">Search, create, edit, delete, or open a timeline while keeping event ordering intact.</p>
        </div>
        <button
          className="button"
          type="button"
          onClick={() => {
            setDraft(initialTimelineDraft);
            setIsEditorOpen(true);
          }}
        >
          Create timeline
        </button>
      </div>

      <div className="admin-toolbar">
        <input
          className="input"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search timelines by title or slug"
        />
      </div>

      <div className="admin-table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Timeline</th>
              <th>Category</th>
              <th>Status</th>
              <th>Events</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleTimelines.map((timeline) => (
              <tr key={timeline.id}>
                <td>
                  <strong>{timeline.title}</strong>
                  <div className="small muted">{timeline.slug}</div>
                </td>
                <td>{timeline.category}</td>
                <td>published</td>
                <td>{timeline.eventCount}</td>
                <td>
                  <div className="pill-row">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        setDraft({
                          id: timeline.id,
                          title: timeline.title,
                          slug: timeline.slug,
                          description: timeline.description,
                          category: timeline.category,
                          status: "published"
                        });
                        setIsEditorOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <Link className="button secondary" href={`/timeline/${timeline.slug}`} target="_blank">
                      View timeline
                    </Link>
                    <button className="button danger" type="button" onClick={() => setDeleteTarget(timeline)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleTimelines.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No timelines match the current search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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

      <AdminModal open={isEditorOpen} title={modalTitle} onClose={closeDraftModal}>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(draft).then((saved) => {
              if (saved) {
                closeDraftModal();
              }
            });
          }}
        >
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <input className="input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Title" required />
            <input className="input" value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="Slug" required />
            <input className="input" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="Category" required />
            <select className="select" value={draft.status} disabled>
              <option value="published">Published</option>
            </select>
          </div>
          <textarea className="textarea" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" required />
          <div className="admin-modal-actions">
            <button className="button secondary" type="button" onClick={closeDraftModal}>
              Cancel
            </button>
            <button className="button" type="submit">
              {draft.id ? "Save timeline" : "Create timeline"}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminModal open={Boolean(deleteTarget)} title="Delete timeline" onClose={() => setDeleteTarget(null)}>
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            Deleting a timeline will remove timeline-event ordering but will not delete the underlying events unless configured.
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
