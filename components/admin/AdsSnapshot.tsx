import { renderPercent } from "@/components/admin/admin-shared";
import type { AdsDashboardData } from "@/src/lib/types";

export function AdsSnapshot({ ads }: { ads: AdsDashboardData | null }) {
  const impressionsToday = ads?.snapshot.impressionsToday || 0;
  const impressionsWeek = impressionsToday * 7;
  const clicksToday = ads?.campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0) || 0;

  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Ad snapshot</h2>
      <div className="admin-metric-tiles">
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Active campaigns</span>
          <strong className="admin-metric-value">{ads?.snapshot.activeCampaigns || 0}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Impressions today</span>
          <strong className="admin-metric-value">{impressionsToday}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Impressions week</span>
          <strong className="admin-metric-value">{impressionsWeek}</strong>
          <span className="admin-metric-subtext">derived estimate</span>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Clicks today</span>
          <strong className="admin-metric-value">{clicksToday}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">CTR</span>
          <strong className="admin-metric-value">{renderPercent(ads?.snapshot.ctr || 0)}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Fill rate</span>
          <strong className="admin-metric-value">{renderPercent(ads?.snapshot.fillRate || 0)}</strong>
        </article>
      </div>
    </section>
  );
}
