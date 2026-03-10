import { renderPercent, renderSeconds, type AnalyticsDataset } from "@/components/admin/admin-shared";

export function BehaviorMetrics({ dataset }: { dataset: AnalyticsDataset }) {
  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Behavior</h2>
      <div className="stats-row">
        <div className="glass-card">
          <strong>{renderSeconds(dataset.analyticsReport?.behavior.avgSessionDuration || 0)}</strong>
          <p className="muted">Avg session duration</p>
        </div>
        <div className="glass-card">
          <strong>{(dataset.analyticsReport?.behavior.timelinesPerSession || 0).toFixed(2)}</strong>
          <p className="muted">Timelines per session</p>
        </div>
        <div className="glass-card">
          <strong>{renderPercent(dataset.analyticsReport?.behavior.bounceRate || 0)}</strong>
          <p className="muted">Bounce rate</p>
        </div>
      </div>
      <div className="admin-panel-grid">
        <div className="glass-card stack">
          <strong>Visits by hour</strong>
          {(dataset.analyticsReport?.behavior.visitsByHour || []).map((point) => (
            <div key={point.label} className="admin-metric-row">
              <span>{point.label}</span>
              <strong>{point.value}</strong>
            </div>
          ))}
        </div>
        <div className="glass-card stack">
          <strong>Visits by day</strong>
          {(dataset.analyticsReport?.behavior.visitsByDay || []).map((point) => (
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
