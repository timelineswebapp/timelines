import type { TimelineRequestRecord } from "@/src/lib/types";

function formatRequestType(type: TimelineRequestRecord["requestType"]): string {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRequestDetails(request: TimelineRequestRecord): Array<{ label: string; value: string }> {
  return [
    { label: "Message", value: request.message || "" },
    { label: "Target timeline", value: request.targetTimeline || "" },
    { label: "Sources / scope", value: request.sourcesScope || "" }
  ].filter((item) => item.value.trim().length > 0);
}

export function RequestsManager({
  requests,
  onUpdateStatus
}: {
  requests: TimelineRequestRecord[];
  onUpdateStatus: (id: number, status: string) => Promise<boolean>;
}) {
  return (
    <section className="glass section-card stack">
      <h2 style={{ marginTop: 0 }}>User timeline suggestions</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Query</th>
            <th>Email</th>
            <th>Details</th>
            <th>Status</th>
            <th>Language</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>{formatRequestType(request.requestType)}</td>
              <td>{request.query}</td>
              <td>{request.email || "—"}</td>
              <td>
                <div className="admin-request-details">
                  {getRequestDetails(request).length > 0 ? (
                    getRequestDetails(request).map((detail) => (
                      <p key={detail.label}>
                        <strong>{detail.label}:</strong> {detail.value}
                      </p>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
              </td>
              <td>{request.status}</td>
              <td>{request.language}</td>
              <td>
                <select
                  className="select"
                  value={request.status}
                  onChange={(event) => void onUpdateStatus(request.id, event.target.value)}
                >
                  <option value="completed">done</option>
                  <option value="planned">hold</option>
                  <option value="rejected">discard</option>
                  <option value="pending">pending</option>
                  <option value="reviewed">reviewed</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
