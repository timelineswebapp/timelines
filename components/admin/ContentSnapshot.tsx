import type { ContentDataset } from "@/components/admin/admin-shared";

export function ContentSnapshot({ dataset }: { dataset: ContentDataset }) {
  return (
    <div className="stack">
      <section className="glass section-card">
        <h2 style={{ marginTop: 0 }}>Content snapshot</h2>
        <div className="stats-row">
          <div className="glass-card">
            <strong>{dataset.overview?.totals.timelines || 0}</strong>
            <p className="muted">Total timelines</p>
          </div>
          <div className="glass-card">
            <strong>{dataset.overview?.totals.events || 0}</strong>
            <p className="muted">Total events</p>
          </div>
          <div className="glass-card">
            <strong>{dataset.overview?.totals.sources || 0}</strong>
            <p className="muted">Total sources</p>
          </div>
        </div>
        <div className="stats-row">
          <div className="glass-card">
            <strong>{dataset.overview?.totals.tags || 0}</strong>
            <p className="muted">Total tags</p>
          </div>
          <div className="glass-card">
            <strong>
              {dataset.overview?.requestStatusBreakdown.find((item) => item.status === "pending")?.count || 0}
            </strong>
            <p className="muted">Pending requests</p>
          </div>
          <div className="glass-card">
            <strong>{dataset.analyticsSnapshot?.contentVelocity.eventsLast30Days || 0}</strong>
            <p className="muted">Events added in 30 days</p>
          </div>
        </div>
      </section>

      <section className="glass section-card">
        <h3 style={{ marginTop: 0 }}>Latest user requests</h3>
        <div className="request-list">
          {(dataset.overview?.latestRequests || []).map((request) => (
            <article key={request.id} className="glass-card">
              <strong>{request.query}</strong>
              <p className="small muted">
                {request.status} • {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
