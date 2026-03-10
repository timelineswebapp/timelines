import { renderPercent, renderSeconds, type AnalyticsDataset } from "@/components/admin/admin-shared";

export function BehaviorMetrics({ dataset }: { dataset: AnalyticsDataset }) {
  const report = dataset.analyticsReport;

  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Behavior</h2>
      <div className="admin-metric-tiles">
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Avg session</span>
          <strong className="admin-metric-value">{renderSeconds(report?.behavior.avgSessionDuration || 0)}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Timelines / session</span>
          <strong className="admin-metric-value">{(report?.behavior.timelinesPerSession || 0).toFixed(2)}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Events opened / session</span>
          <strong className="admin-metric-value">{(report?.behavior.eventsOpenedPerSession || 0).toFixed(2)}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Bounce rate</span>
          <strong className="admin-metric-value">{renderPercent(report?.behavior.bounceRate || 0)}</strong>
        </article>
      </div>
      <div className="admin-panel-grid admin-panel-grid-compact">
        <div className="glass-card stack admin-list-card">
          <strong>Visits by hour</strong>
          {(report?.behavior.visitsByHour || []).map((point) => (
            <div key={point.label} className="admin-metric-row">
              <span>{point.label}</span>
              <strong>{point.value}</strong>
            </div>
          ))}
        </div>
        <div className="glass-card stack admin-list-card">
          <strong>Visits by day</strong>
          {(report?.behavior.visitsByDay || []).map((point) => (
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
