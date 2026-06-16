import type { TaxonomyGovernanceSnapshot } from "@/src/lib/types";

function StatusPill({ label }: { label: string }) {
  return <span className="admin-tag-pill">{label}</span>;
}

export function TaxonomyGovernance({ snapshot }: { snapshot: TaxonomyGovernanceSnapshot | null }) {
  const categories = snapshot?.categories || [];
  const tags = snapshot?.tags || [];
  const duplicateCandidates = snapshot?.duplicateCandidates || [];
  const summary = snapshot?.summary;

  return (
    <div className="stack">
      <section className="glass section-card">
        <h2 style={{ marginTop: 0 }}>Taxonomy governance</h2>
        <p className="muted">
          Governance metadata is visible here without changing public category pages, tag pages, search, or imports.
        </p>
        <div className="stats-row">
          <div className="glass-card">
            <strong>{summary?.governedCategories || 0}</strong>
            <p className="muted">Governed categories</p>
          </div>
          <div className="glass-card">
            <strong>{summary?.ungovernedCategories || 0}</strong>
            <p className="muted">Ungoverned categories</p>
          </div>
          <div className="glass-card">
            <strong>{summary?.unreviewedTags || 0}</strong>
            <p className="muted">Unreviewed tags</p>
          </div>
        </div>
        <div className="stats-row">
          <div className="glass-card">
            <strong>{summary?.orphanedTags || 0}</strong>
            <p className="muted">Orphaned tags</p>
          </div>
          <div className="glass-card">
            <strong>{summary?.duplicateCandidates || 0}</strong>
            <p className="muted">Duplicate candidates</p>
          </div>
          <div className="glass-card">
            <strong>{summary?.governedTags || 0}</strong>
            <p className="muted">Governed tags</p>
          </div>
        </div>
      </section>

      <section className="glass section-card">
        <h3 style={{ marginTop: 0 }}>Categories</h3>
        <div className="admin-record-list">
          {categories.map((category) => (
            <article key={category.canonicalSlug} className="glass-card stack">
              <div>
                <strong>{category.canonicalName}</strong>
                <p className="small muted">
                  /category/{category.canonicalSlug} · {category.timelineCount} timelines
                </p>
              </div>
              <div className="pill-row">
                <StatusPill label={category.isGoverned ? "governed" : "ungoverned"} />
                <StatusPill label={category.status} />
                <StatusPill label={`${category.aliasCount} aliases`} />
                <StatusPill label={`${category.redirectCount} redirects`} />
                <StatusPill label={`${category.mergeCount} merges`} />
              </div>
              {category.rawNames.length > 1 ? (
                <p className="small muted">Raw names: {category.rawNames.join(", ")}</p>
              ) : null}
            </article>
          ))}
          {categories.length === 0 ? <div className="admin-empty-state muted">No category usage found.</div> : null}
        </div>
      </section>

      <section className="glass section-card">
        <h3 style={{ marginTop: 0 }}>Tags</h3>
        <div className="admin-record-list">
          {tags.map((tag) => (
            <article key={tag.id} className="glass-card stack">
              <div>
                <strong>{tag.name}</strong>
                <p className="small muted">
                  /tag/{tag.slug} · {tag.usageCount} milestones
                </p>
              </div>
              <div className="pill-row">
                <StatusPill label={tag.isGoverned ? "governed" : "ungoverned"} />
                <StatusPill label={tag.moderationStatus.replaceAll("_", " ")} />
                <StatusPill label={`${tag.aliasCount} aliases`} />
                <StatusPill label={`${tag.redirectCount} redirects`} />
                <StatusPill label={`${tag.mergeCount} merges`} />
                {tag.promotionCandidate ? <StatusPill label="concept candidate" /> : null}
              </div>
              {tag.governanceNotes ? <p className="small muted">{tag.governanceNotes}</p> : null}
            </article>
          ))}
          {tags.length === 0 ? <div className="admin-empty-state muted">No tags found.</div> : null}
        </div>
      </section>

      <section className="glass section-card">
        <h3 style={{ marginTop: 0 }}>Audit signals</h3>
        <div className="admin-record-list">
          {duplicateCandidates.map((candidate) => (
            <article key={`${candidate.kind}-${candidate.slug}`} className="glass-card">
              <strong>{candidate.kind} duplicate candidate: {candidate.slug}</strong>
              <p className="small muted">{candidate.names.join(", ")}</p>
            </article>
          ))}
          {(snapshot?.orphanedTags || []).map((tag) => (
            <article key={`orphaned-tag-${tag.id}`} className="glass-card">
              <strong>Orphaned tag: {tag.name}</strong>
              <p className="small muted">No milestones currently use /tag/{tag.slug}.</p>
            </article>
          ))}
          {duplicateCandidates.length === 0 && (snapshot?.orphanedTags || []).length === 0 ? (
            <div className="admin-empty-state muted">No duplicate or orphaned taxonomy signals detected.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
