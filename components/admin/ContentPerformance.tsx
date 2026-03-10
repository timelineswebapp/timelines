import type { AnalyticsDataset } from "@/components/admin/admin-shared";

export function ContentPerformance({ dataset }: { dataset: AnalyticsDataset }) {
  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Content performance</h2>
      <div className="admin-panel-grid">
        <div className="glass-card stack">
          <strong>Top timelines</strong>
          {(dataset.analyticsReport?.contentPerformance.topTimelines || []).map((item) => (
            <div key={item.timelineId} className="admin-metric-row">
              <span>{item.title}</span>
              <strong>{item.views} views</strong>
            </div>
          ))}
        </div>
        <div className="glass-card stack">
          <strong>Top events</strong>
          {(dataset.analyticsReport?.contentPerformance.topEvents || []).map((item) => (
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
