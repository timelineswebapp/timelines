import type { AnalyticsDataset } from "@/components/admin/admin-shared";

export function ContentPerformance({ dataset }: { dataset: AnalyticsDataset }) {
  const report = dataset.analyticsReport;

  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Content performance</h2>
      <div className="admin-metric-tiles">
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Top timelines</span>
          <strong className="admin-metric-value">{report?.contentPerformance.topTimelines.length || 0}</strong>
          <span className="admin-metric-subtext">ranked items</span>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Top events</span>
          <strong className="admin-metric-value">{report?.contentPerformance.topEvents.length || 0}</strong>
          <span className="admin-metric-subtext">ranked items</span>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Best timeline views</span>
          <strong className="admin-metric-value">{report?.contentPerformance.topTimelines[0]?.views || 0}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Best event views</span>
          <strong className="admin-metric-value">{report?.contentPerformance.topEvents[0]?.views || 0}</strong>
        </article>
      </div>
      <div className="admin-panel-grid admin-panel-grid-compact">
        <div className="glass-card stack admin-list-card">
          <strong>Top timelines</strong>
          {(report?.contentPerformance.topTimelines || []).map((item) => (
            <div key={item.timelineId} className="admin-metric-row">
              <span>{item.title}</span>
              <strong>{item.views} views</strong>
            </div>
          ))}
        </div>
        <div className="glass-card stack admin-list-card">
          <strong>Top events</strong>
          {(report?.contentPerformance.topEvents || []).map((item) => (
            <div key={item.eventId} className="admin-metric-row">
              <span>{item.title}</span>
              <strong>{item.views} views</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
