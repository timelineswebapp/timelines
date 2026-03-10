import type { AnalyticsDataset } from "@/components/admin/admin-shared";

export function GrowthCharts({ dataset }: { dataset: AnalyticsDataset }) {
  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Growth</h2>
      <div className="admin-panel-grid">
        <div className="glass-card stack">
          <strong>Traffic over time</strong>
          {(dataset.analyticsReport?.growth.trafficOverTime || []).map((point) => (
            <div key={point.label} className="admin-metric-row">
              <span>{point.label}</span>
              <strong>{point.value}</strong>
            </div>
          ))}
        </div>
        <div className="glass-card stack">
          <strong>Searches over time</strong>
          {(dataset.analyticsReport?.growth.searchesOverTime || []).map((point) => (
            <div key={point.label} className="admin-metric-row">
              <span>{point.label}</span>
              <strong>{point.value}</strong>
            </div>
          ))}
        </div>
        <div className="glass-card stack">
          <strong>Timeline views over time</strong>
          {(dataset.analyticsReport?.growth.timelineViewsOverTime || []).map((point) => (
            <div key={point.label} className="admin-metric-row">
              <span>{point.label}</span>
              <strong>{point.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
