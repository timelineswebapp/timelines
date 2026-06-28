"use client";
import { useCallback, useEffect, useState } from "react";
import type { AdminFetcher } from "@/components/admin/admin-shared";
import type { OperationalNotification, OperationsSnapshot, TopicOperationsDetail, TopicWorkItem } from "@/src/server/factory-operations/contracts";

export function AdminFactoryOperations({ token, fetchAdmin, statusHandlers }: {
  token: string;
  fetchAdmin: AdminFetcher;
  statusHandlers: { setStatus: (value: string) => void; setError: (value: string) => void; onLoaded: () => void };
}) {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [title, setTitle] = useState("");
  const [inbox, setInbox] = useState<OperationalNotification[]>([]);
  const [detail, setDetail] = useState<TopicOperationsDetail | null>(null);
  const [reliability, setReliability] = useState<{
    metrics: Array<{ metricKey: string; value: number; unit: string }>;
    health: Array<{ institution: string; status: string; reasons: string[] }>;
    alerts: Array<{ id: string; severity: string; status: string; message: string }>;
  } | null>(null);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [operations, notifications, reliabilityDashboard] = await Promise.all([
        fetchAdmin<OperationsSnapshot>("/api/admin/factory/operations"),
        fetchAdmin<OperationalNotification[]>("/api/admin/factory/operations/inbox"),
        fetchAdmin<typeof reliability>("/api/admin/operations/reliability")
      ]);
      setSnapshot(operations);
      setInbox(notifications);
      setReliability(reliabilityDashboard);
      statusHandlers.onLoaded();
      statusHandlers.setError("");
    } catch (error) { statusHandlers.setError(error instanceof Error ? error.message : "Operations load failed."); }
  }, [fetchAdmin, statusHandlers, token]);
  useEffect(() => { void load(); }, [load]);

  async function command(action: string) {
    await fetchAdmin("/api/admin/factory/operations/control", { method: "POST", body: JSON.stringify({ action, actor: "founder" }) });
    statusHandlers.setStatus(`Factory operation '${action}' completed.`);
    await load();
  }
  async function mutate(topic: TopicWorkItem, action: string, extra: Record<string, unknown> = {}) {
    await fetchAdmin(`/api/admin/factory/operations/topics/${topic.id}`, { method: "PATCH", body: JSON.stringify({ action, actor: "founder", ...extra }) });
    await load();
  }
  async function addTopic() {
    await fetchAdmin("/api/admin/factory/operations", { method: "POST", body: JSON.stringify({ title, source: "founder", priority: 100, maxRetries: 3, actor: "founder" }) });
    setTitle("");
    await load();
  }
  async function openTopic(topicId: string) {
    setDetail(await fetchAdmin<TopicOperationsDetail>(`/api/admin/factory/operations/topics/${topicId}`));
  }
  async function transitionAlert(id: string, action: "acknowledge" | "resolve") {
    await fetchAdmin(`/api/admin/operations/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ action, actor: "founder" }) });
    await load();
  }
  return <div className="stack">
    <section className="glass section-card">
      <span className="eyebrow">System Health</span>
      <h2>Institution Health</h2>
      <div className="admin-action-row">
        {reliability?.health.map((item) => <span className="pill" key={item.institution}>{item.institution}: {item.status}</span>)}
      </div>
      <p className="muted">Throughput {reliability?.metrics.find((item) => item.metricKey === "publication.throughput_hour")?.value || 0}/hour · Publication latency {Math.round(reliability?.metrics.find((item) => item.metricKey === "publication.latency_ms")?.value || 0)}ms · Replay queue {reliability?.metrics.find((item) => item.metricKey === "workflow.replay_count")?.value || 0}</p>
      <h3>Alerts</h3>
      {reliability?.alerts.length ? reliability.alerts.map((alert) => <div className="admin-action-row" key={alert.id}>
        <span>{alert.severity} · {alert.message}</span>
        {alert.status === "open" ? <button className="button secondary" onClick={() => void transitionAlert(alert.id, "acknowledge")}>Acknowledge</button> : null}
        <button className="button secondary" onClick={() => void transitionAlert(alert.id, "resolve")}>Resolve</button>
      </div>) : <p className="muted">No active operational alerts.</p>}
    </section>
    <section className="glass section-card">
      <span className="eyebrow">Founder Inbox</span>
      <h2>Decisions and exceptions</h2>
      <div className="stack">
        {inbox.length === 0 ? <p className="muted">No pending founder action.</p> : inbox.map((item) =>
          <button className="button secondary" key={item.id} onClick={() => void openTopic(item.topicId)}>
            {item.title} · {item.category.replaceAll("_", " ")}
          </button>)}
      </div>
    </section>
    <section className="glass section-card stack">
      <span className="eyebrow">Factory Operations Center</span>
      <h2 style={{ margin: 0 }}>Automation: {snapshot?.control.mode || "unavailable"}</h2>
      <div className="admin-action-row">
        <button className="button" onClick={() => void command("start")}>Start Automation</button>
        <button className="button secondary" onClick={() => void command("stop")}>Stop Automation</button>
        <button className="button secondary" onClick={() => void command("pause_after_current")}>Pause After Current</button>
        <button className="button secondary" onClick={() => void command("resume")}>Resume</button>
        <button className="button secondary" onClick={() => void command("run_one_cycle")}>Run One Cycle</button>
      </div>
      <div className="admin-action-row">
        <input className="input" value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} placeholder="Founder-entered topic" />
        <button className="button" disabled={title.trim().length < 3} onClick={() => void addTopic()}>Add Topic</button>
      </div>
    </section>
    <section className="glass section-card">
      <h2>Queue Status</h2>
      <p className="muted">Depth {snapshot?.metrics.queueDepth || 0} · Active workers {snapshot?.metrics.activeCount || 0} · Throughput {snapshot?.metrics.throughputPerHour || 0}/hour · Failures {snapshot?.failures.length || 0} · Dead letters {snapshot?.deadLetters.length || 0}</p>
      <div className="stack">
        {snapshot?.queue.map((topic) => <article className="glass section-card" key={topic.id}>
          <button className="button secondary" onClick={() => void openTopic(topic.id)}><strong>{topic.title}</strong></button>
          <p className="small muted">{topic.status} · {topic.currentStage} · priority {topic.priority} · retries {topic.retryCount}/{topic.maxRetries}</p>
          <p className="small muted">Worker health: {topic.status === "running" ? `heartbeat ${topic.heartbeatAt || "pending"}` : "idle"} · ETA: {topic.status === "completed" ? "complete" : "stage dependent"}</p>
          <div className="admin-action-row">
            {topic.status === "waiting" ? <button className="button" onClick={() => void mutate(topic, "resume")}>Verify Decision & Continue</button> : null}
            {topic.status === "failed" || topic.status === "dead_letter" ? <button className="button" onClick={() => void mutate(topic, "retry")}>Retry</button> : null}
            <button className="button secondary" onClick={() => void mutate(topic, "reprioritize", { priority: Math.min(1000, topic.priority + 10) })}>Raise Priority</button>
            <button className="button secondary" onClick={() => void mutate(topic, "replay", { replayStage: topic.lastCertifiedStage })}>Replay Boundary</button>
            {!["completed", "cancelled"].includes(topic.status) ? <button className="button secondary" onClick={() => void mutate(topic, "cancel")}>Cancel</button> : null}
          </div>
        </article>)}
      </div>
    </section>
    {detail ? <section className="glass section-card stack">
      <span className="eyebrow">Topic Operations</span>
      <h2>{detail.topic.title}</h2>
      <p className="muted">Workflow {detail.topic.status} · institution {detail.topic.currentStage === "governance" ? "Governance" : detail.topic.currentStage === "published" || detail.topic.currentStage === "completed" ? "Published Memory" : "Factory"} · stage {detail.topic.currentStage}</p>
      <p>Evidence: {detail.topic.currentStage === "research" ? "collecting" : detail.topic.stageContext.researchPipelineRunId ? "validated" : "pending"} · Governance: {detail.topic.stageContext.governancePublicationPackageId ? detail.topic.currentStage : "not submitted"}</p>
      <h3>Publication and replay history</h3>
      {detail.events.map((event) => <p className="small" key={event.id}>{event.createdAt} · {event.institution} · {event.eventType}</p>)}
      <h3>Failures and audit</h3>
      {detail.history.map((record) => <p className="small" key={record.id}>{record.createdAt} · {record.action} · {record.outcome}</p>)}
      {detail.verifications.map((verification) => <p className="small" key={verification.id}>Publication verification: {verification.status}</p>)}
    </section> : null}
  </div>;
}
