import type { AnalyticsDataset } from "@/components/admin/admin-shared";

export function AudienceMetrics({ dataset }: { dataset: AnalyticsDataset }) {
  const report = dataset.analyticsReport;
  const topTimelinesCount = report?.contentPerformance.topTimelines.length || 0;
  const topEventsCount = report?.contentPerformance.topEvents.length || 0;
  const searchesToday = report?.growth.searchesOverTime.at(-1)?.value || 0;
  const noResultSearches = report?.searchIntelligence.noResultSearches || 0;

  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Audience</h2>
      {!report?.trackingConfigured ? (
        <p className="muted" style={{ margin: 0 }}>
          Live audience tracking is not configured. This module stays active with safe zero values and content-derived fallback metrics.
        </p>
      ) : null}
      <div className="admin-metric-tiles">
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Users today</span>
          <strong className="admin-metric-value">{report?.audience.usersToday || 0}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Users week</span>
          <strong className="admin-metric-value">{report?.audience.usersWeek || 0}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Users month</span>
          <strong className="admin-metric-value">{report?.audience.usersMonth || 0}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Top timelines</span>
          <strong className="admin-metric-value">{topTimelinesCount}</strong>
          <span className="admin-metric-subtext">tracked list size</span>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Top events</span>
          <strong className="admin-metric-value">{topEventsCount}</strong>
          <span className="admin-metric-subtext">tracked list size</span>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Requests 30d</span>
          <strong className="admin-metric-value">{dataset.analyticsSnapshot?.contentVelocity.requestsLast30Days || 0}</strong>
          <span className="admin-metric-subtext">pending not tracked here</span>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Searches today</span>
          <strong className="admin-metric-value">{searchesToday}</strong>
          <span className="admin-metric-subtext">latest growth point</span>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">No-result searches</span>
          <strong className="admin-metric-value">{noResultSearches}</strong>
        </article>
      </div>
    </section>
  );
}
