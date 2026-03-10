"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AnalyticsSnapshot,
  DashboardOverview,
  EventRecord,
  SourceRecord,
  TagRecord,
  TimelineRequestRecord,
  TimelineSummary
} from "@/src/lib/types";

type AdminDataset = {
  overview: DashboardOverview | null;
  analytics: AnalyticsSnapshot | null;
  timelines: TimelineSummary[];
  events: EventRecord[];
  sources: SourceRecord[];
  tags: TagRecord[];
  requests: TimelineRequestRecord[];
};

const initialDataset: AdminDataset = {
  overview: null,
  analytics: null,
  timelines: [],
  events: [],
  sources: [],
  tags: [],
  requests: []
};

export function AdminDashboard() {
  const [token, setToken] = useState("");
  const [dataset, setDataset] = useState<AdminDataset>(initialDataset);
  const [status, setStatus] = useState("Provide the admin token to unlock dashboard actions.");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "timelines" | "events" | "sources" | "tags" | "requests" | "analytics" | "import">("overview");
  const [isLoaded, setIsLoaded] = useState(false);

  const adminHeaders = useMemo(
    () => ({
      "content-type": "application/json",
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
            "x-admin-token": token
          }
        : {})
    }),
    [token]
  );

  const fetchAdmin = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...adminHeaders,
        ...(init?.headers || {})
      }
    });
    const payload = (await response.json()) as { ok: boolean; data?: T; error?: { message?: string } };
    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.error?.message || `Request failed for ${url}`);
    }
    return payload.data;
  }, [adminHeaders]);

  const reload = useCallback(async () => {
    setError("");
    setStatus("Loading admin datasets...");

    try {
      const [overview, analytics, timelines, events, sources, tags, requests] = await Promise.all([
        fetchAdmin<DashboardOverview>("/api/admin/analytics"),
        fetchAdmin<AnalyticsSnapshot>("/api/admin/analytics?mode=snapshot"),
        fetchAdmin<TimelineSummary[]>("/api/admin/timelines"),
        fetchAdmin<EventRecord[]>("/api/admin/events"),
        fetchAdmin<SourceRecord[]>("/api/admin/sources"),
        fetchAdmin<TagRecord[]>("/api/admin/tags"),
        fetchAdmin<TimelineRequestRecord[]>("/api/admin/requests")
      ]);

      setDataset({ overview, analytics, timelines, events, sources, tags, requests });
      setStatus("Dashboard synchronized.");
      setIsLoaded(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin data.");
      setStatus("Admin datasets unavailable.");
    }
  }, [fetchAdmin]);

  useEffect(() => {
    if (token) {
      void reload();
    }
  }, [token, reload]);

  const submitJson = useCallback(async (endpoint: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) => {
    setError("");
    setStatus("Saving changes...");
    try {
      await fetchAdmin(endpoint, {
        method,
        body: body ? JSON.stringify(body) : undefined
      });
      await reload();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Save failed.");
      setStatus("Save failed.");
    }
  }, [fetchAdmin, reload]);

  return (
    <div className="admin-grid">
      <aside className="glass section-card admin-sidebar stack">
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow">Admin</span>
          <strong>Editorial control surface</strong>
          <p className="muted" style={{ margin: 0 }}>
            CRUD operations, request review, analytics, and import preview all route through authenticated API handlers.
          </p>
        </div>
        <input
          className="input"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Admin API token"
        />
        <div className="stack" style={{ gap: 8 }}>
          {(["overview", "timelines", "events", "sources", "tags", "requests", "analytics", "import"] as const).map((tab) => (
            <button
              key={tab}
              className={`button ${activeTab === tab ? "" : "secondary"}`}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {status}
        </p>
        {error ? (
          <p className="small" style={{ color: "var(--danger)", margin: 0 }}>
            {error}
          </p>
        ) : null}
      </aside>

      <section className="stack">
        {activeTab === "overview" ? (
          <div className="stack">
            <section className="glass section-card">
              <h2 style={{ marginTop: 0 }}>Overview</h2>
              <div className="stats-row">
                <div className="glass-card">
                  <strong>{dataset.overview?.totals.timelines || 0}</strong>
                  <p className="muted">Timelines</p>
                </div>
                <div className="glass-card">
                  <strong>{dataset.overview?.totals.events || 0}</strong>
                  <p className="muted">Events</p>
                </div>
                <div className="glass-card">
                  <strong>{dataset.overview?.totals.requests || 0}</strong>
                  <p className="muted">Timeline requests</p>
                </div>
              </div>
            </section>
            <section className="glass section-card">
              <h3 style={{ marginTop: 0 }}>Request queue</h3>
              <div className="request-list">
                {dataset.overview?.latestRequests.map((request) => (
                  <article key={request.id} className="glass-card">
                    <strong>{request.query}</strong>
                    <p className="small muted">{request.status} • {new Date(request.createdAt).toLocaleDateString()}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "timelines" ? (
          <section className="glass section-card stack">
            <h2 style={{ marginTop: 0 }}>Timeline management</h2>
            <form
              className="stack"
              action={async (formData) => {
                await submitJson("/api/admin/timelines", "POST", {
                  title: String(formData.get("title") || ""),
                  slug: String(formData.get("slug") || ""),
                  description: String(formData.get("description") || ""),
                  category: String(formData.get("category") || "")
                });
              }}
            >
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <input className="input" name="title" placeholder="Timeline title" required />
                <input className="input" name="slug" placeholder="timeline-slug" required />
                <input className="input" name="category" placeholder="Category" required />
                <button className="button" type="submit">Create timeline</button>
              </div>
              <textarea className="textarea" name="description" placeholder="Description" required />
            </form>
            <table className="table">
              <thead>
                <tr>
                  <th>Timeline</th>
                  <th>Category</th>
                  <th>Events</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dataset.timelines.map((timeline) => (
                  <tr key={timeline.id}>
                    <td>{timeline.title}</td>
                    <td>{timeline.category}</td>
                    <td>{timeline.eventCount}</td>
                    <td>
                      <button className="button danger" type="button" onClick={() => void submitJson(`/api/admin/timelines/${timeline.id}`, "DELETE")}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {activeTab === "events" ? (
          <section className="glass section-card stack">
            <h2 style={{ marginTop: 0 }}>Event management</h2>
            <form
              className="stack"
              action={async (formData) => {
                await submitJson("/api/admin/events", "POST", {
                  timelineId: Number(formData.get("timelineId")),
                  eventOrder: Number(formData.get("eventOrder") || 1),
                  date: String(formData.get("date") || ""),
                  datePrecision: String(formData.get("datePrecision") || "day"),
                  title: String(formData.get("title") || ""),
                  description: String(formData.get("description") || ""),
                  importance: Number(formData.get("importance") || 3),
                  location: String(formData.get("location") || "") || null,
                  imageUrl: String(formData.get("imageUrl") || "") || null,
                  sourceIds: String(formData.get("sourceIds") || "")
                    .split(",")
                    .map((value) => Number(value.trim()))
                    .filter(Boolean),
                  tagIds: String(formData.get("tagIds") || "")
                    .split(",")
                    .map((value) => Number(value.trim()))
                    .filter(Boolean)
                });
              }}
            >
              <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <select className="select" name="timelineId" required>
                  <option value="">Choose timeline</option>
                  {dataset.timelines.map((timeline) => (
                    <option key={timeline.id} value={timeline.id}>
                      {timeline.title}
                    </option>
                  ))}
                </select>
                <input className="input" name="eventOrder" type="number" min={1} defaultValue={1} required />
                <input className="input" name="date" type="date" required />
                <select className="select" name="datePrecision" defaultValue="day">
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="approximate">Approximate</option>
                </select>
                <input className="input" name="importance" type="number" min={1} max={5} defaultValue={3} required />
                <input className="input" name="location" placeholder="Location" />
              </div>
              <input className="input" name="title" placeholder="Event title" required />
              <textarea className="textarea" name="description" placeholder="Event description" required />
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <input className="input" name="imageUrl" placeholder="Image URL" />
                <input className="input" name="sourceIds" placeholder="Source IDs e.g. 1,2" />
                <input className="input" name="tagIds" placeholder="Tag IDs e.g. 1,3" />
              </div>
              <button className="button" type="submit">Create event</button>
            </form>
            <div className="admin-lists">
              {dataset.events.slice(0, 20).map((event) => (
                <article key={event.id} className="glass-card stack">
                  <strong>{event.title}</strong>
                  <p className="small muted" style={{ margin: 0 }}>{event.date} • importance {event.importance}</p>
                  <button className="button danger" type="button" onClick={() => void submitJson(`/api/admin/events/${event.id}`, "DELETE")}>
                    Delete
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "sources" ? (
          <section className="glass section-card stack">
            <h2 style={{ marginTop: 0 }}>Source management</h2>
            <form
              className="form-grid"
              style={{ gridTemplateColumns: "1fr 1fr 180px auto" }}
              action={async (formData) => {
                await submitJson("/api/admin/sources", "POST", {
                  publisher: String(formData.get("publisher") || ""),
                  url: String(formData.get("url") || ""),
                  credibilityScore: Number(formData.get("credibilityScore") || 0.8)
                });
              }}
            >
              <input className="input" name="publisher" placeholder="Publisher" required />
              <input className="input" name="url" placeholder="https://source" required />
              <input className="input" name="credibilityScore" type="number" min={0} max={1} step={0.01} defaultValue={0.8} required />
              <button className="button" type="submit">Create source</button>
            </form>
            <table className="table">
              <thead>
                <tr>
                  <th>Publisher</th>
                  <th>URL</th>
                  <th>Score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dataset.sources.map((source) => (
                  <tr key={source.id}>
                    <td>{source.publisher}</td>
                    <td>{source.url}</td>
                    <td>{source.credibilityScore}</td>
                    <td>
                      <button className="button danger" type="button" onClick={() => void submitJson(`/api/admin/sources/${source.id}`, "DELETE")}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {activeTab === "tags" ? (
          <section className="glass section-card stack">
            <h2 style={{ marginTop: 0 }}>Tag management</h2>
            <form
              className="form-grid"
              style={{ gridTemplateColumns: "1fr 1fr auto" }}
              action={async (formData) => {
                await submitJson("/api/admin/tags", "POST", {
                  name: String(formData.get("name") || ""),
                  slug: String(formData.get("slug") || "")
                });
              }}
            >
              <input className="input" name="name" placeholder="Tag name" required />
              <input className="input" name="slug" placeholder="tag-slug" required />
              <button className="button" type="submit">Create tag</button>
            </form>
            <div className="pill-row" style={{ flexWrap: "wrap" }}>
              {dataset.tags.map((tag) => (
                <button key={tag.id} className="button secondary" type="button" onClick={() => void submitJson(`/api/admin/tags/${tag.id}`, "DELETE")}>
                  {tag.name} ×
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "requests" ? (
          <section className="glass section-card stack">
            <h2 style={{ marginTop: 0 }}>Timeline requests</h2>
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
                {dataset.requests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.query}</td>
                    <td>{request.status}</td>
                    <td>{request.language}</td>
                    <td>
                      <select
                        className="select"
                        defaultValue={request.status}
                        onChange={(event) =>
                          void submitJson("/api/admin/requests", "PATCH", {
                            id: request.id,
                            status: event.target.value
                          })
                        }
                      >
                        <option value="pending">pending</option>
                        <option value="reviewed">reviewed</option>
                        <option value="planned">planned</option>
                        <option value="rejected">rejected</option>
                        <option value="completed">completed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {activeTab === "analytics" ? (
          <section className="glass section-card stack">
            <h2 style={{ marginTop: 0 }}>Analytics</h2>
            <div className="stats-row">
              <div className="glass-card">
                <strong>{dataset.analytics?.contentVelocity.timelinesLast30Days || 0}</strong>
                <p className="muted">Timelines added in 30 days</p>
              </div>
              <div className="glass-card">
                <strong>{dataset.analytics?.contentVelocity.eventsLast30Days || 0}</strong>
                <p className="muted">Events added in 30 days</p>
              </div>
              <div className="glass-card">
                <strong>{dataset.analytics?.contentVelocity.requestsLast30Days || 0}</strong>
                <p className="muted">Requests submitted in 30 days</p>
              </div>
            </div>
            <div className="pill-row" style={{ flexWrap: "wrap" }}>
              <span className="pill">GA4: {dataset.analytics?.operational.gaConfigured ? "configured" : "missing"}</span>
              <span className="pill">AdSense: {dataset.analytics?.operational.adsConfigured ? "configured" : "missing"}</span>
              <span className="pill">Database: {dataset.analytics?.operational.databaseConfigured ? "configured" : "sample mode"}</span>
            </div>
          </section>
        ) : null}

        {activeTab === "import" ? (
          <section className="glass section-card stack">
            <h2 style={{ marginTop: 0 }}>Import preview</h2>
            <form
              className="stack"
              action={async (formData) => {
                const response = await fetchAdmin<{ totals: { rows: number; duplicates: number; accepted: number } }>("/api/admin/import/preview", {
                  method: "POST",
                  body: JSON.stringify({
                    format: String(formData.get("format") || "json"),
                    timelineId: Number(formData.get("timelineId")),
                    content: String(formData.get("content") || "[]")
                  })
                });
                setStatus(`Import preview: ${response.totals.accepted} accepted, ${response.totals.duplicates} duplicates.`);
              }}
            >
              <div className="form-grid" style={{ gridTemplateColumns: "180px 1fr" }}>
                <select className="select" name="format" defaultValue="json">
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
                <select className="select" name="timelineId" required>
                  <option value="">Choose timeline</option>
                  {dataset.timelines.map((timeline) => (
                    <option key={timeline.id} value={timeline.id}>
                      {timeline.title}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className="textarea"
                name="content"
                defaultValue={`[
  {
    "date": "2025-01-01",
    "datePrecision": "day",
    "title": "Sample import event",
    "description": "Structured import preview payload.",
    "importance": 3
  }
]`}
              />
              <button className="button" type="submit">
                Run preview
              </button>
            </form>
          </section>
        ) : null}

        {!token && !isLoaded ? (
          <section className="glass section-card">
            <p className="muted" style={{ margin: 0 }}>
              Production deployments should set `ADMIN_API_TOKEN`. In local development, leaving it unset keeps the dashboard usable for seeded content.
            </p>
          </section>
        ) : null}
      </section>
    </div>
  );
}
