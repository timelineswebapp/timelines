import type { TimelineRequestRecord } from "@/src/lib/types";

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
            <th>Query</th>
            <th>Status</th>
            <th>Language</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>{request.query}</td>
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
