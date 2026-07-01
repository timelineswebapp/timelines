"use client";
import { useCallback, useEffect, useState } from "react";
import type { AdminFetcher } from "@/components/admin/admin-shared";
import type { OperationalNotification, OperationsSnapshot, TopicOperationsDetail, TopicWorkItem } from "@/src/server/factory-operations/contracts";
import type { FounderAction, FounderHomeReadModel } from "@/src/server/founder/contracts";

const FOUNDER_HOME_REFRESH_MS = 5_000;

function founderActionLabel(action: FounderAction) {
  if (action === "return_for_revision") return "Return for Revision";
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function founderErrorMessage(error: unknown, action: FounderAction | "approve") {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "FOUNDER_REVIEW_INCOMPLETE") return "This review is not ready for approval yet. Review the evidence summary and try again.";
  if (code === "GOVERNANCE_DECISION_INCOMPLETE") return "The review decision is not complete yet. Complete the requested judgment and try again.";
  if (code === "INBOX_ITEM_NOT_ACTIONABLE") return "This item has already been completed. Refresh Home to see the latest work.";
  if (code === "TOPIC_NOT_MUTABLE") return "This Topic is currently processing. Wait for the current work to finish, then try again.";
  return action === "approve"
    ? "The Topic could not be approved. Review its current status and try again."
    : "The action could not be completed. Refresh Home and try again.";
}

function formatOperationalTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function operationalHealthName(value: string) {
  const normalized = value.replaceAll("_", " ").toLowerCase();
  if (normalized.includes("published")) return "Published knowledge";
  if (normalized.includes("projection")) return "Public experience";
  if (normalized.includes("library")) return "Historical library";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function AdminFactoryOperations({ token, fetchAdmin, statusHandlers, view, onFounderStatus }: {
  token: string;
  fetchAdmin: AdminFetcher;
  statusHandlers: { setStatus: (value: string) => void; setError: (value: string) => void; onLoaded: () => void };
  view: "home" | "queue" | "settings";
  onFounderStatus: (status: { institution: string; factory: string; mode: string }) => void;
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
  const [home, setHome] = useState<FounderHomeReadModel | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      if (view === "home") {
        const briefing = await fetchAdmin<FounderHomeReadModel>("/api/admin/founder/home");
        setHome(briefing);
        onFounderStatus({
          institution: briefing.summary.institutionStatus,
          factory: briefing.summary.processing > 0 ? "Processing" : briefing.summary.factoryStatus,
          mode: briefing.summary.factoryMode
        });
        statusHandlers.setStatus("Founder authenticated");
        statusHandlers.onLoaded();
        statusHandlers.setError("");
        return;
      }
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
  }, [fetchAdmin, onFounderStatus, statusHandlers, token, view]);
  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      await load();
      if (!cancelled) {
        refreshTimer = setTimeout(refresh, FOUNDER_HOME_REFRESH_MS);
      }
    }

    void refresh();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [load]);

  async function command(action: string) {
    setPendingAction(`factory:${action}`);
    try {
      await fetchAdmin("/api/admin/factory/operations/control", { method: "POST", body: JSON.stringify({ action, actor: "founder" }) });
      statusHandlers.setStatus("Operational session active");
      statusHandlers.setError("");
      await load();
    } catch {
      statusHandlers.setError("The Factory state could not be changed. Refresh Home and try again.");
    } finally {
      setPendingAction(null);
    }
  }
  async function mutate(topic: TopicWorkItem, action: string, extra: Record<string, unknown> = {}) {
    await fetchAdmin(`/api/admin/factory/operations/topics/${topic.id}`, { method: "PATCH", body: JSON.stringify({ action, actor: "founder", ...extra }) });
    await load();
  }
  async function addTopic() {
    const topics = [...new Set(title.split(/[,\n]+/).map((item) => item.trim()).filter((item) => item.length >= 3))].slice(0, 50);
    if (!topics.length) return;
    await Promise.all(topics.map((topic) => fetchAdmin("/api/admin/factory/operations", { method: "POST", body: JSON.stringify({ title: topic, source: "founder", priority: 100, maxRetries: 3, actor: "founder" }) })));
    setTitle("");
    statusHandlers.setStatus(`${topics.length} ${topics.length === 1 ? "topic" : "topics"} queued.`);
    await load();
  }
  async function openTopic(topicId: string) {
    setDetail(await fetchAdmin<TopicOperationsDetail>(`/api/admin/factory/operations/topics/${topicId}`));
  }
  async function transitionAlert(id: string, action: "acknowledge" | "resolve") {
    await fetchAdmin(`/api/admin/operations/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ action, actor: "founder" }) });
    await load();
  }
  async function inboxAction(notificationId: string, topicId: string, action: FounderAction) {
    setPendingAction(`${notificationId}:${action}`);
    try {
      await fetchAdmin("/api/admin/founder/inbox", {
        method: "POST", body: JSON.stringify({ notificationId, topicId, action, actor: "founder" })
      });
      statusHandlers.setStatus(action === "return_for_revision" ? "Revision requested." : `${action.charAt(0).toUpperCase()}${action.slice(1)} completed.`);
      statusHandlers.setError("");
      await load();
    } catch (error) {
      statusHandlers.setError(founderErrorMessage(error, action));
    } finally {
      setPendingAction(null);
    }
  }
  async function approveVisitorRequest(requestId: number) {
    setPendingAction(`visitor:${requestId}`);
    try {
      await fetchAdmin("/api/admin/founder/visitor-requests/approve", {
        method: "POST", body: JSON.stringify({ requestId, actor: "founder" })
      });
      statusHandlers.setStatus("Visitor Topic approved and queued.");
      statusHandlers.setError("");
      await load();
    } catch (error) {
      statusHandlers.setError(founderErrorMessage(error, "approve"));
    } finally {
      setPendingAction(null);
    }
  }
  const sourceLabel = (source: TopicWorkItem["source"]) => source === "founder" ? "Founder" : source === "public_request" ? "Visitor" : "Factory";
  const stageLabel = (stage: TopicWorkItem["currentStage"]) => ({
    queued: "Queued", research: "Research", extraction: "Preparing", publication_candidate: "Preparing",
    founder_review: "Waiting Review", governance: "Waiting Review", library_admission: "Publishing",
    published: "Published", completed: "Published"
  })[stage];
  const progress = (topic: TopicWorkItem) => Math.round((["queued", "research", "extraction", "publication_candidate", "founder_review", "governance", "library_admission", "published", "completed"].indexOf(topic.currentStage) / 8) * 100);
  if (view === "settings") return <div className="stack"><section className="glass section-card">
    <span className="eyebrow">Factory Mode</span><h2>{snapshot?.control.mode === "running" ? "Autonomous" : snapshot?.control.mode === "pause_after_current" ? "Maintenance" : "Conservative"}</h2>
    <p className="muted">Choose how the institution processes new Topics. Current work remains isolated when review is required.</p>
    <div className="admin-action-row"><button className="button" onClick={() => void command("start")}>Autonomous</button><button className="button secondary" onClick={() => void command("pause_after_current")}>Maintenance</button><button className="button secondary" onClick={() => void command("stop")}>Conservative</button></div>
  </section></div>;

  if (view === "home") return <div className="stack">
    <section className="glass section-card fos-command-card" aria-labelledby="institution-summary-title">
      <div className="fos-command-heading">
        <div>
          <span className="eyebrow">Institution Summary</span>
          <h2 id="institution-summary-title">Is everything operating?</h2>
          <p className="muted">Publishing health, current workload, and Factory control.</p>
        </div>
        <div className="fos-factory-control" aria-label="Factory control">
          <span className={`fos-state-indicator fos-state-${home?.summary.factoryStatus.toLowerCase() || "stopped"}`} />
          <div>
            <span className="small muted">Factory</span>
            <strong>{(home?.summary.processing || 0) > 0 ? "Processing" : home?.summary.factoryStatus || "Unavailable"}</strong>
          </div>
          {home?.summary.factoryStatus === "Stopped" ? <button className="button" disabled={pendingAction !== null} onClick={() => void command("start")}>Start Factory</button> : null}
          {home?.summary.factoryStatus === "Paused" ? <button className="button" disabled={pendingAction !== null} onClick={() => void command("resume")}>Resume Factory</button> : null}
          {home?.summary.factoryStatus === "Running" ? <button className="button secondary" disabled={pendingAction !== null} onClick={() => void command("pause_after_current")}>{(home?.summary.processing || 0) > 0 ? "Pause After Current Topic" : "Pause Factory"}</button> : null}
        </div>
      </div>
      <div className="fos-stat-grid fos-stat-grid-wide">
        {[
          ["Institution", home?.summary.institutionStatus || "—"],
          ["Published Today", home?.summary.publishedToday ?? "—"],
          ["Processing", home?.summary.processing ?? "—"],
          ["Queue", home?.summary.queueDepth ?? "—"],
          ["Inbox", home?.summary.inboxCount ?? "—"],
          ["Failed", home?.summary.failedTopics ?? "—"]
        ].map(([label, value]) => <div className="fos-metric" key={label}><strong className={`fos-stat ${value === "Healthy" ? "fos-status-success" : value === "Critical" ? "fos-status-danger" : ""}`}>{value}</strong><span className="small muted">{label}</span></div>)}
      </div>
      <div className="fos-mode-summary"><span className="small muted">Mode</span><strong>{home?.summary.factoryMode || "—"}</strong><span className="small muted">{home?.summary.factoryMode === "Autonomous" ? "Processes Topics continuously." : home?.summary.factoryMode === "Maintenance" ? "Finishes current work before pausing." : "Processes Topics under Founder supervision."}</span></div>
    </section>
    <section className="glass section-card stack fos-add-topics">
      <span className="eyebrow">Add Topics</span><h2 style={{ margin: 0 }}>What should TiMELiNES publish next?</h2>
      <p className="muted">Enter one Topic, or separate multiple Topics with commas or new lines.</p>
      <div className="fos-topic-entry"><textarea aria-label="Topics to publish" className="input fos-topic-textarea" value={title} maxLength={4000} rows={4} onChange={(event) => setTitle(event.target.value)} placeholder={"Telephone\nSteam Engine\nApollo Program"} /><button className="button fos-queue-button" disabled={title.trim().length < 3} onClick={() => void addTopic()}>Queue Topics</button></div>
    </section>
    <section className="glass section-card">
      <span className="eyebrow">Founder Inbox</span><h2>What requires your attention</h2>
      {home?.inbox.length ? home.inbox.map((item) => <article className="fos-list-card" key={item.id}>
        <div><strong>{item.topic}</strong><p className="small muted">{item.reason}</p></div>
        <div className="admin-action-row">{item.actions.map((action) => <button className={action === "approve" || action === "retry" ? "button" : "button secondary"} disabled={pendingAction !== null} key={action} onClick={() => void inboxAction(item.id, item.topicId, action)}>{founderActionLabel(action)}</button>)}</div>
      </article>) : <div className="fos-empty-state"><strong>Everything is progressing automatically.</strong><p className="muted">No Founder decisions are currently required.</p></div>}
    </section>
    <section className="glass section-card">
      <span className="eyebrow">Visitor Requests</span><h2>Topics requested by visitors</h2>
      {home?.visitorRequests.length ? home.visitorRequests.map((request) => <article className="fos-list-card" key={request.id}><div><strong>{request.topic}</strong><p className="small muted">Requested {formatOperationalTime(request.submittedAt)}</p></div><button className="button" disabled={pendingAction !== null} onClick={() => void approveVisitorRequest(request.id)}>Approve</button></article>) : <div className="fos-empty-state"><strong>Visitor demand is clear.</strong><p className="muted">No Visitor Requests are waiting for approval.</p></div>}
    </section>
    <section className="glass section-card">
      <span className="eyebrow">Recent Publications</span><h2>Recently published</h2>
      {home?.recentPublications.length ? home.recentPublications.map((publication) => <article className="fos-list-card" key={`${publication.topic}:${publication.publishedAt}`}><div><strong>{publication.topic}</strong><p className="small muted">{formatOperationalTime(publication.publishedAt)} · <span className={`fos-inline-status ${publication.verification === "Passed" ? "fos-inline-success" : publication.verification === "Failed" ? "fos-inline-danger" : "fos-inline-waiting"}`}>Verification {publication.verification}</span></p></div>{publication.publicPath ? <a className="button secondary" href={publication.publicPath} target="_blank" rel="noreferrer">View Publication</a> : <span className="small muted">Public link preparing</span>}</article>) : <div className="fos-empty-state"><strong>Publications will appear after verification.</strong><p className="muted">No verified Topics have been published yet.</p></div>}
    </section>
    <section className="glass section-card">
      <span className="eyebrow">Activity Feed</span><h2>Latest activity</h2>
      <div className="fos-activity">{home?.activity.length ? home.activity.map((item) => <div className="fos-activity-row" key={item.id}><span className={`fos-activity-dot fos-${item.severity}`} /><div><strong>{item.topic}</strong><p className="small muted">{item.message} · {formatOperationalTime(item.occurredAt)}</p></div></div>) : <div className="fos-empty-state"><strong>The Factory is ready.</strong><p className="muted">Factory activity will appear here as Topics progress.</p></div>}</div>
    </section>
    <section className="glass section-card">
      <span className="eyebrow">Operational Health</span><h2>Institutional services</h2>
      <div className="admin-action-row">{home?.health.map((item) => <span className="pill" key={item.name}>{operationalHealthName(item.name)}: {item.status}</span>)}</div>
      {home?.summary.institutionStatus === "Healthy" ? <p className="small fos-health-message">All publishing services are operating normally.</p> : <p className="small muted">One or more publishing services require attention.</p>}
    </section>
  </div>;

  return <div className="stack">
    <section className="glass section-card">
      <span className="eyebrow">Operational Health</span>
      <h2>Institution Health</h2>
      <div className="admin-action-row">
        {reliability?.health.map((item) => <span className="pill" key={item.institution}>{item.institution}: {item.status}</span>)}
      </div>
      <p className="muted">Publishing {reliability?.metrics.find((item) => item.metricKey === "publication.throughput_hour")?.value || 0} Topics per hour · {snapshot?.metrics.activeCount || 0} currently processing</p>
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
    <section className="glass section-card">
      <span className="eyebrow">{view === "queue" ? "Production Queue" : "Queue Summary"}</span>
      <h2>What the institution is producing</h2>
      <div className="stack">
        {snapshot?.queue.map((topic) => <article className="glass section-card" key={topic.id}>
          <button className="button secondary" onClick={() => void openTopic(topic.id)}><strong>{topic.title}</strong></button>
          <p className="small muted">{sourceLabel(topic.source)} · {stageLabel(topic.currentStage)} · Priority {topic.priority}</p>
          <div className="fos-progress"><span style={{ width: `${progress(topic)}%` }} /></div>
          <p className="small muted">{progress(topic)}% complete · {topic.status === "completed" ? "Completed" : "Completion time updates as work progresses"}</p>
          <div className="admin-action-row">
            {topic.status === "waiting" ? <button className="button" onClick={() => void mutate(topic, "resume")}>Verify Decision & Continue</button> : null}
            {topic.status === "failed" || topic.status === "dead_letter" ? <button className="button" onClick={() => void mutate(topic, "retry")}>Retry</button> : null}
            <button className="button secondary" onClick={() => void mutate(topic, "reprioritize", { priority: Math.min(1000, topic.priority + 10) })}>Raise Priority</button>
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
