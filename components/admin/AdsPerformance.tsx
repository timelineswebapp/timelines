import type { AdsDashboardData } from "@/src/lib/types";

export function AdsPerformance({ ads }: { ads: AdsDashboardData | null }) {
  const campaigns = ads?.campaigns || [];
  const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);
  const totalRevenue = campaigns.reduce((sum, campaign) => sum + campaign.revenue, 0);
  const totalImpressions = campaigns.reduce((sum, campaign) => sum + campaign.impressions, 0);

  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Performance</h2>
      <div className="admin-metric-tiles">
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Campaigns</span>
          <strong className="admin-metric-value">{campaigns.length}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Impressions</span>
          <strong className="admin-metric-value">{totalImpressions}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Clicks</span>
          <strong className="admin-metric-value">{totalClicks}</strong>
        </article>
        <article className="glass-card admin-metric-tile">
          <span className="admin-metric-label">Revenue</span>
          <strong className="admin-metric-value">{totalRevenue.toFixed(2)}</strong>
        </article>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Impressions</th>
            <th>Clicks</th>
            <th>CTR</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td>{campaign.campaignName}</td>
              <td>{campaign.impressions}</td>
              <td>{campaign.clicks}</td>
              <td>{campaign.impressions > 0 ? `${((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%` : "0.00%"}</td>
              <td>{campaign.revenue.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
