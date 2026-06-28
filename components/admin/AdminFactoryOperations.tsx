"use client";
import { useCallback, useEffect, useState } from "react";
import type { AdminFetcher } from "@/components/admin/admin-shared";
import type { OperationsSnapshot, TopicWorkItem } from "@/src/server/factory-operations/contracts";

export function AdminFactoryOperations({ token, fetchAdmin, statusHandlers }: {
  token: string;
  fetchAdmin: AdminFetcher;
  statusHandlers: { setStatus: (value: string) => void; setError: (value: string) => void; onLoaded: () => void };
}) {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [title, setTitle] = useState("");
  const load = useCallback(async () => {
    if (!token) return;
    try {
      setSnapshot(await fetchAdmin<OperationsSnapshot>("/api/admin/factory/operations"));
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
  return <div className="stack">
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
          <strong>{topic.title}</strong>
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
  </div>;
}
