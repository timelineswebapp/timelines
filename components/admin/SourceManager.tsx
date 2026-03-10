"use client";

import { useState } from "react";
import type { SourceRecord, TagRecord } from "@/src/lib/types";
import { initialSourceDraft, initialTagDraft, type SourceDraft, type TagDraft } from "@/components/admin/admin-shared";

export function SourceManager({
  sources,
  tags,
  onSubmitSource,
  onDeleteSource,
  onSubmitTag,
  onDeleteTag
}: {
  sources: SourceRecord[];
  tags: TagRecord[];
  onSubmitSource: (draft: SourceDraft) => Promise<boolean>;
  onDeleteSource: (id: number) => Promise<boolean>;
  onSubmitTag: (draft: TagDraft) => Promise<boolean>;
  onDeleteTag: (id: number) => Promise<boolean>;
}) {
  const [sourceDraft, setSourceDraft] = useState<SourceDraft>(initialSourceDraft);
  const [tagDraft, setTagDraft] = useState<TagDraft>(initialTagDraft);

  return (
    <div className="admin-panel-grid">
      <section className="glass section-card stack">
        <h2 style={{ marginTop: 0 }}>Source management</h2>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmitSource(sourceDraft).then((saved) => {
              if (saved) {
                setSourceDraft(initialSourceDraft);
              }
            });
          }}
        >
          <input className="input" value={sourceDraft.publisher} onChange={(event) => setSourceDraft((current) => ({ ...current, publisher: event.target.value }))} placeholder="Publisher" required />
          <input className="input" value={sourceDraft.url} onChange={(event) => setSourceDraft((current) => ({ ...current, url: event.target.value }))} placeholder="https://source" required />
          <input className="input" type="number" min={0} max={1} step={0.01} value={sourceDraft.credibilityScore} onChange={(event) => setSourceDraft((current) => ({ ...current, credibilityScore: event.target.value }))} required />
          <div className="pill-row">
            <button className="button" type="submit">
              {sourceDraft.id ? "Update source" : "Create source"}
            </button>
            {sourceDraft.id ? (
              <button type="button" className="button secondary" onClick={() => setSourceDraft(initialSourceDraft)}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <table className="table">
          <thead>
            <tr>
              <th>Publisher</th>
              <th>Score</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <strong>{source.publisher}</strong>
                  <div className="small muted">{source.url}</div>
                </td>
                <td>{source.credibilityScore}</td>
                <td>
                  <div className="pill-row">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() =>
                        setSourceDraft({
                          id: source.id,
                          publisher: source.publisher,
                          url: source.url,
                          credibilityScore: String(source.credibilityScore)
                        })
                      }
                    >
                      Edit
                    </button>
                    <button className="button danger" type="button" onClick={() => void onDeleteSource(source.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="glass section-card stack">
        <h2 style={{ marginTop: 0 }}>Event tags</h2>
        <p className="muted">Tags remain primarily attached at event level. Timeline tags are still derived from linked events.</p>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmitTag(tagDraft).then((saved) => {
              if (saved) {
                setTagDraft(initialTagDraft);
              }
            });
          }}
        >
          <input className="input" value={tagDraft.name} onChange={(event) => setTagDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Tag name" required />
          <input className="input" value={tagDraft.slug} onChange={(event) => setTagDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="tag-slug" required />
          <div className="pill-row">
            <button className="button" type="submit">
              {tagDraft.id ? "Update tag" : "Create tag"}
            </button>
            {tagDraft.id ? (
              <button type="button" className="button secondary" onClick={() => setTagDraft(initialTagDraft)}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>

        <div className="admin-lists">
          {tags.map((tag) => (
            <article key={tag.id} className="glass-card stack">
              <strong>{tag.name}</strong>
              <p className="small muted" style={{ margin: 0 }}>{tag.slug}</p>
              <div className="pill-row">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() =>
                    setTagDraft({
                      id: tag.id,
                      name: tag.name,
                      slug: tag.slug
                    })
                  }
                >
                  Edit
                </button>
                <button className="button danger" type="button" onClick={() => void onDeleteTag(tag.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
