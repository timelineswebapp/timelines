import type { AnalyticsDataset } from "@/components/admin/admin-shared";

export function AudienceMetrics({ dataset }: { dataset: AnalyticsDataset }) {
  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Audience</h2>
      {!dataset.analyticsReport?.trackingConfigured ? (
        <p className="muted" style={{ margin: 0 }}>
          Live audience tracking is not configured. This module stays active with safe zero values and content-derived fallback metrics.
        </p>
      ) : null}
      <div className="stats-row">
        <div className="glass-card">
          <strong>{dataset.analyticsReport?.audience.usersToday || 0}</strong>
          <p className="muted">Users today</p>
        </div>
        <div className="glass-card">
          <strong>{dataset.analyticsReport?.audience.usersWeek || 0}</strong>
          <p className="muted">Users this week</p>
        </div>
        <div className="glass-card">
          <strong>{dataset.analyticsReport?.audience.usersMonth || 0}</strong>
          <p className="muted">Users this month</p>
        </div>
      </div>
      <div className="stats-row">
        <div className="glass-card">
          <strong>{dataset.analyticsReport?.audience.newUsers || 0}</strong>
          <p className="muted">New users</p>
        </div>
        <div className="glass-card">
          <strong>{dataset.analyticsReport?.audience.returningUsers || 0}</strong>
          <p className="muted">Returning users</p>
        </div>
        <div className="glass-card">
          <strong>{dataset.analyticsSnapshot?.contentVelocity.requestsLast30Days || 0}</strong>
          <p className="muted">Requests in 30 days</p>
        </div>
      </div>
    </section>
  );
}
