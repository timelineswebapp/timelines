import { renderPercent } from "@/components/admin/admin-shared";
import type { AdsDashboardData } from "@/src/lib/types";

export function AdsSnapshot({ ads }: { ads: AdsDashboardData | null }) {
  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Ad snapshot</h2>
      <div className="stats-row">
        <div className="glass-card">
          <strong>{ads ? ads.snapshot.revenueToday.toFixed(2) : "0.00"}</strong>
          <p className="muted">Revenue today</p>
        </div>
        <div className="glass-card">
          <strong>{ads ? ads.snapshot.revenueMonth.toFixed(2) : "0.00"}</strong>
          <p className="muted">Revenue this month</p>
        </div>
        <div className="glass-card">
          <strong>{ads?.snapshot.activeCampaigns || 0}</strong>
          <p className="muted">Active campaigns</p>
        </div>
      </div>
      <div className="stats-row">
        <div className="glass-card">
          <strong>{renderPercent(ads?.snapshot.fillRate || 0)}</strong>
          <p className="muted">Fill rate</p>
        </div>
        <div className="glass-card">
          <strong>{ads?.snapshot.impressionsToday || 0}</strong>
          <p className="muted">Impressions today</p>
        </div>
        <div className="glass-card">
          <strong>{renderPercent(ads?.snapshot.ctr || 0)}</strong>
          <p className="muted">CTR</p>
        </div>
      </div>
    </section>
  );
}
