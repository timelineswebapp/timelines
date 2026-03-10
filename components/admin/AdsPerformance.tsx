import type { AdsDashboardData } from "@/src/lib/types";

export function AdsPerformance({ ads }: { ads: AdsDashboardData | null }) {
  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Performance</h2>
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
          {(ads?.campaigns || []).map((campaign) => (
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
