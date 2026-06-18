"use client";

import type { RelationshipRecoveryReport } from "@/src/lib/types";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function relationshipCoverage(report: RelationshipRecoveryReport | null) {
  if (!report || report.totals.validRows === 0) {
    return "0.00%";
  }

  return `${((report.totals.matchedRows / report.totals.validRows) * 100).toFixed(2)}%`;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric-card">
      <span className="eyebrow">{label}</span>
      <strong className="admin-metric-value">{typeof value === "number" ? formatNumber(value) : value}</strong>
    </div>
  );
}

export function DataHealth({
  report,
  onPreview,
  onApply
}: {
  report: RelationshipRecoveryReport | null;
  onPreview: () => Promise<void>;
  onApply: () => Promise<void>;
}) {
  const database = report?.totals.database;
  const canApply = Boolean(report && report.totals.tagLinksToInsert + report.totals.sourceLinksToInsert > 0);

  return (
    <section className="glass section-card stack">
      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Data Health</span>
        <h2 style={{ margin: 0 }}>Relationship recovery</h2>
      </div>

      <div className="admin-actions">
        <button className="button" type="button" onClick={() => void onPreview()}>
          Preview recovery
        </button>
        <button className="button secondary" type="button" onClick={() => void onApply()} disabled={!canApply}>
          Apply recovery
        </button>
      </div>

      <div className="admin-metric-grid">
        <Metric label="Events" value={database?.events ?? 0} />
        <Metric label="Timeline links" value={database?.timelineEvents ?? 0} />
        <Metric label="Tags" value={database?.tags ?? 0} />
        <Metric label="Sources" value={database?.sources ?? 0} />
        <Metric label="Event tag links" value={database?.eventTags ?? 0} />
        <Metric label="Event source links" value={database?.eventSources ?? 0} />
      </div>

      {report ? (
        <>
          <div className="admin-metric-grid">
            <Metric label="CSV files" value={report.totals.files} />
            <Metric label="Valid rows" value={report.totals.validRows} />
            <Metric label="Matched rows" value={report.totals.matchedRows} />
            <Metric label="Match coverage" value={relationshipCoverage(report)} />
            <Metric label="Tag links pending" value={report.totals.tagLinksToInsert} />
            <Metric label="Source links pending" value={report.totals.sourceLinksToInsert} />
            <Metric label="Unmatched rows" value={report.totals.unmatchedRows} />
            <Metric label="Ambiguous rows" value={report.totals.ambiguousRows} />
          </div>

          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Timeline</th>
                  <th>Title</th>
                  <th>Event</th>
                  <th>Tags</th>
                  <th>Sources</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.slice(0, 80).map((row) => (
                  <tr key={`${row.file}:${row.rowNumber}:${row.status}`}>
                    <td>{row.status}</td>
                    <td>{row.timelineSlug}</td>
                    <td>{row.title}</td>
                    <td>{row.eventId ?? ""}</td>
                    <td>{row.tags.join(", ")}</td>
                    <td>{row.sources.length}</td>
                    <td>{row.message || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
