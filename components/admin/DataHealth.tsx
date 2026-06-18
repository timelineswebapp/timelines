"use client";

import type { RelationshipRecoveryHistoryItem, RelationshipRecoveryReport } from "@/src/lib/types";

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
  history,
  onPreview,
  onApply,
  onRefreshHistory,
  onSelectReport,
  onDownloadJson,
  onDownloadCsv
}: {
  report: RelationshipRecoveryReport | null;
  history: RelationshipRecoveryHistoryItem[];
  onPreview: () => Promise<void>;
  onApply: () => Promise<void>;
  onRefreshHistory: () => Promise<void>;
  onSelectReport: (id: number) => Promise<void>;
  onDownloadJson: (id: number) => Promise<void>;
  onDownloadCsv: (id: number) => Promise<void>;
}) {
  const database = report?.totals.database;
  const canApply = Boolean(report && report.totals.tagLinksToInsert + report.totals.sourceLinksToInsert > 0);
  const selectedReportId = report?.id ?? null;

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
        <button className="button secondary" type="button" onClick={() => void onRefreshHistory()}>
          Refresh history
        </button>
        <button className="button secondary" type="button" onClick={() => selectedReportId ? void onDownloadJson(selectedReportId) : undefined} disabled={!selectedReportId}>
          Download JSON
        </button>
        <button className="button secondary" type="button" onClick={() => selectedReportId ? void onDownloadCsv(selectedReportId) : undefined} disabled={!selectedReportId}>
          Download CSV
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

      <div className="stack" style={{ gap: 8 }}>
        <span className="eyebrow">Recovery History</span>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Mode</th>
                <th>Matched</th>
                <th>Unmatched</th>
                <th>Ambiguous</th>
                <th>Tag pending</th>
                <th>Source pending</th>
                <th>Inserted tags</th>
                <th>Inserted sources</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.generatedAt).toLocaleString()}</td>
                  <td>{item.mode}</td>
                  <td>{formatNumber(item.matchedRows)}</td>
                  <td>{formatNumber(item.unmatchedRows)}</td>
                  <td>{formatNumber(item.ambiguousRows)}</td>
                  <td>{formatNumber(item.tagLinksPending)}</td>
                  <td>{formatNumber(item.sourceLinksPending)}</td>
                  <td>{formatNumber(item.insertedTagLinks)}</td>
                  <td>{formatNumber(item.insertedSourceLinks)}</td>
                  <td>
                    <div className="admin-actions">
                      <button className="button secondary" type="button" onClick={() => void onSelectReport(item.id)}>
                        Open
                      </button>
                      <button className="button secondary" type="button" onClick={() => void onDownloadJson(item.id)}>
                        JSON
                      </button>
                      <button className="button secondary" type="button" onClick={() => void onDownloadCsv(item.id)}>
                        CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
