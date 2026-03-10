import { renderPercent, type AnalyticsDataset } from "@/components/admin/admin-shared";

export function SearchIntelligence({ dataset }: { dataset: AnalyticsDataset }) {
  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>Search intelligence</h2>
      <div className="stats-row">
        <div className="glass-card">
          <strong>{dataset.analyticsReport?.searchIntelligence.noResultSearches || 0}</strong>
          <p className="muted">No-result searches</p>
        </div>
        <div className="glass-card">
          <strong>{renderPercent(dataset.analyticsReport?.searchIntelligence.searchClickRate || 0)}</strong>
          <p className="muted">Search click rate</p>
        </div>
        <div className="glass-card">
          <strong>{dataset.analyticsReport?.searchIntelligence.topSearchQueries.length || 0}</strong>
          <p className="muted">Tracked top queries</p>
        </div>
      </div>
    </section>
  );
}
