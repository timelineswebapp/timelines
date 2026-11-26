"use client";
import { useCallback, useEffect, useState } from "react";
import type { AdminFetcher } from "@/components/admin/admin-shared";
import { factoryOperationalAvailabilityMessage } from "@/components/admin/factory-operational-availability";
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

function operationsLoadErrorMessage(error: unknown) {
  const availabilityMessage = factoryOperationalAvailabilityMessage(error);
  if (availabilityMessage) return availabilityMessage;
  return error instanceof Error ? error.message : "Operations load failed.";
}

function deferredReentryErrorMessage(error: unknown) {
  const availabilityMessage = factoryOperationalAvailabilityMessage(error);
  if (availabilityMessage) return availabilityMessage;
  return "The bounded retry request could not be recorded. Existing deferred work has not changed.";
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
  const [deferredV2Topics, setDeferredV2Topics] = useState<Array<{
    topicId: string;
    runId: string;
    generation: number;
    stage: string;
    updatedAt: string;
    terminalFailureRecordId: string | null;
    outcome: { classification: "PUBLIC_EVIDENCE_LIMITATION" | "RESEARCH_BUDGET_EXHAUSTED"; reentryState: "REQUIRES_RELEVANT_CHANGE" | "REQUIRES_AUTHORIZED_RETRY"; detailedReason: string };
    operationalFeasibility: { state: "REENTRY_CONDITION_REQUIRED"; requiredCondition: "RELEVANT_EVIDENCE_CHANGE" | "AUTHORIZED_RETRY"; terminalAt: string; attemptsConsumed: number; budgetConsumed: Record<string, number>; failureClass: string };
    reentryRequests: Array<{ requestId: string; trigger: "RELEVANT_EVIDENCE_CHANGE" | "AUTHORIZED_RETRY"; requestedAt: string; state: "REQUESTED" | "CONSUMED"; consumedAt: string | null; queuedRunId: string | null }>;
  }> | null>([]);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [sourceSubmission, setSourceSubmission] = useState<{ operationId: string; url: string; rationale: string } | null>(null);
  const [authorizedRetry, setAuthorizedRetry] = useState<{ operationId: string; reason: string } | null>(null);
  const [deferredReentryRequests, setDeferredReentryRequests] = useState<Record<string, { state: "CREATED" | "IDEMPOTENT"; requestId: string } | undefined>>({});
  const [sourceCandidates, setSourceCandidates] = useState<Array<{ candidateId: string; operationId: string; submittedUrl: string; rationale: string; submittedBy: string; createdAt: string; state: "CANDIDATE" }> | null>([]);
  const [sourceCandidateInspections, setSourceCandidateInspections] = useState<Record<string, {
    candidateId: string;
    state: "CANDIDATE";
    submittedAt: string;
    validation: { state: "AUTHORITY_ELIGIBLE"; recordedAt: string } | null;
    retrieval: { state: "RETRIEVED_UNQUALIFIED" | "RETRIEVAL_REJECTED"; recordedAt: string; retrievalDisposition: "NEWLY_RETRIEVED" | "CACHE_REUSED" | "REVALIDATED" | "ACCESS_LIMITED" | "UNAVAILABLE" | null; rejectionCode: string | null } | null;
    qualifyingEvidence: false;
    reentryAuthorized: false;
  } | undefined>>({});
  const [inspectingCandidateId, setInspectingCandidateId] = useState<string | null>(null);
  const [generationRetries, setGenerationRetries] = useState<Array<{ topicId: string; jobId: string; generation: number; origin: "user" | "autonomous"; state: "RETRY_SCHEDULED"; nextRetryAt: string; updatedAt: string; lastErrorPresent: boolean; enqueueRetryCount: number }> | null>([]);
  const [generationRetryHealth, setGenerationRetryHealth] = useState<{ scheduledCount: number; dueCount: number; oldestDueAt: string | null } | null>(null);
  const [generationEnqueueFailures, setGenerationEnqueueFailures] = useState<Array<{ topicId: string; jobId: string; generation: number; origin: "user" | "autonomous"; state: "FAILED"; failedAt: string; enqueueRetryCount: number; lastErrorPresent: boolean }> | null>(null);
  const [factoryOperationalAvailability, setFactoryOperationalAvailability] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      if (view === "home") {
        const [briefingResult, enqueueFailuresResult] = await Promise.allSettled([
          fetchAdmin<FounderHomeReadModel>("/api/admin/founder/home"),
          fetchAdmin<typeof generationEnqueueFailures>("/api/admin/factory/v2/generation-enqueue-failures")
        ]);
        if (briefingResult.status === "rejected") throw briefingResult.reason;
        const briefing = briefingResult.value;
        setHome(briefing);
        onFounderStatus({
          institution: briefing.summary.institutionStatus,
          factory: briefing.summary.processing > 0 ? "Processing" : briefing.summary.factoryStatus,
          mode: briefing.summary.factoryMode
        });
        statusHandlers.setStatus("Founder authenticated");
        statusHandlers.onLoaded();
        if (enqueueFailuresResult.status === "fulfilled") {
          setGenerationEnqueueFailures(enqueueFailuresResult.value);
          setFactoryOperationalAvailability(null);
          statusHandlers.setError("");
          return;
        }
        const availabilityMessage = factoryOperationalAvailabilityMessage(enqueueFailuresResult.reason);
        if (!availabilityMessage) throw enqueueFailuresResult.reason;
        setGenerationEnqueueFailures(null);
        setFactoryOperationalAvailability(availabilityMessage);
        statusHandlers.setError(availabilityMessage);
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
      try {
        const [deferredTopics, candidates, retries, retryHealth, enqueueFailures] = await Promise.all([
          fetchAdmin<NonNullable<typeof deferredV2Topics>>("/api/admin/factory/v2/deferred"),
          fetchAdmin<NonNullable<typeof sourceCandidates>>("/api/admin/factory/v2/source-submissions"),
          fetchAdmin<NonNullable<typeof generationRetries>>("/api/admin/factory/v2/generation-retries"),
          fetchAdmin<typeof generationRetryHealth>("/api/admin/factory/v2/generation-retry-health"),
          fetchAdmin<NonNullable<typeof generationEnqueueFailures>>("/api/admin/factory/v2/generation-enqueue-failures")
        ]);
        setDeferredV2Topics(deferredTopics);
        setSourceCandidates(candidates);
        setGenerationRetries(retries);
        setGenerationRetryHealth(retryHealth);
        setGenerationEnqueueFailures(enqueueFailures);
        setFactoryOperationalAvailability(null);
        statusHandlers.setError("");
      } catch (error) {
        const availabilityMessage = factoryOperationalAvailabilityMessage(error);
        if (!availabilityMessage) throw error;
        setDeferredV2Topics(null);
        setSourceCandidates(null);
        setGenerationRetries(null);
        setGenerationRetryHealth(null);
        setGenerationEnqueueFailures(null);
        setFactoryOperationalAvailability(availabilityMessage);
        statusHandlers.setError(availabilityMessage);
      }
    } catch (error) { statusHandlers.setError(operationsLoadErrorMessage(error)); }
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
      await fetchAdmin("/api/admin/factory/operations/control", { method: "POST", body: JSON.stringify({ action }) });
      statusHandlers.setStatus("Operational session active");
      statusHandlers.setError("");
      await load();
    } catch {
      statusHandlers.setError("The Factory state could not be changed. Refresh Home and try again.");
    } finally {
      setPendingAction(null);
    }
  }

  async function inspectSourceCandidate(candidateId: string) {
    setInspectingCandidateId(candidateId);
    try {
      const inspection = await fetchAdmin<NonNullable<typeof sourceCandidateInspections[string]>>(`/api/admin/factory/v2/source-submissions/${encodeURIComponent(candidateId)}`);
      setSourceCandidateInspections((current) => ({ ...current, [candidateId]: inspection }));
      statusHandlers.setError("");
    } catch (error) {
      statusHandlers.setError(error instanceof Error ? error.message : "The recorded source-candidate status could not be loaded.");
    } finally {
      setInspectingCandidateId(null);
    }
  }
  async function mutate(topic: TopicWorkItem, action: string, extra: Record<string, unknown> = {}) {
    await fetchAdmin(`/api/admin/factory/operations/topics/${topic.id}`, { method: "PATCH", body: JSON.stringify({ action, ...extra }) });
    await load();
  }
  async function addTopic() {
    const topics = [...new Set(title.split(/[,\n]+/).map((item) => item.trim()).filter((item) => item.length >= 3))].slice(0, 50);
    if (!topics.length) return;
    await Promise.all(topics.map((topic) => fetchAdmin("/api/admin/factory/operations", { method: "POST", body: JSON.stringify({ title: topic, source: "founder", priority: 100, maxRetries: 3 }) })));
    setTitle("");
    statusHandlers.setStatus(`${topics.length} ${topics.length === 1 ? "topic" : "topics"} queued.`);
    await load();
  }
  async function openTopic(topicId: string) {
    setDetail(await fetchAdmin<TopicOperationsDetail>(`/api/admin/factory/operations/topics/${topicId}`));
  }
  async function transitionAlert(id: string, action: "acknowledge" | "resolve") {
    await fetchAdmin(`/api/admin/operations/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
    await load();
  }
  async function inboxAction(notificationId: string, topicId: string, action: FounderAction) {
    setPendingAction(`${notificationId}:${action}`);
    try {
      await fetchAdmin("/api/admin/founder/inbox", {
        method: "POST", body: JSON.stringify({ notificationId, topicId, action })
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
        method: "POST", body: JSON.stringify({ requestId })
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
  async function submitSourceCandidate() {
    if (!sourceSubmission) return;
    setPendingAction(`source:${sourceSubmission.operationId}`);
    try {
      await fetchAdmin("/api/admin/factory/v2/source-submissions", { method: "POST", body: JSON.stringify({ operationId: sourceSubmission.operationId, submittedUrl: sourceSubmission.url, rationale: sourceSubmission.rationale }) });
      setSourceSubmission(null);
      statusHandlers.setStatus("Source candidate preserved for governed Factory validation.");
      statusHandlers.setError("");
      await load();
    } catch (error) {
      statusHandlers.setError(error instanceof Error ? error.message : "The source candidate could not be submitted.");
    } finally { setPendingAction(null); }
  }
  async function requestAuthorizedRetry() {
    if (!authorizedRetry) return;
    const operationId = authorizedRetry.operationId;
    setPendingAction(`reentry:${operationId}`);
    try {
      const result = await fetchAdmin<{ state: "CREATED" | "IDEMPOTENT"; requestId: string }>("/api/admin/factory/v2/deferred-reentry", {
        method: "POST",
        body: JSON.stringify({
          operationId,
          trigger: "AUTHORIZED_RETRY",
          authorizationReason: authorizedRetry.reason
        })
      });
      setDeferredReentryRequests((current) => ({ ...current, [operationId]: result }));
      setAuthorizedRetry(null);
      statusHandlers.setStatus(result.state === "CREATED" ? "Bounded retry request recorded for Factory review." : "Existing bounded retry request confirmed.");
      statusHandlers.setError("");
    } catch (error) {
      statusHandlers.setError(deferredReentryErrorMessage(error));
    } finally { setPendingAction(null); }
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
          <span className="eyebrow">Current Public Corpus</span>
          <h2 id="institution-summary-title">Is the reader platform healthy?</h2>
          <p className="muted">Live V2 and public-reader state. Legacy Factory records are shown separately below.</p>
        </div>
        <div className="fos-factory-control" aria-label="Factory control">
          <span className={`fos-state-indicator fos-state-${home?.summary.factoryStatus.toLowerCase() || "stopped"}`} />
          <div>
            <span className="small muted">Public corpus</span>
            <strong>{home?.current.publicCorpus === "available" ? "Available" : home?.current.publicCorpus === "empty" ? "Empty" : "Unavailable"}</strong>
          </div>
        </div>
      </div>
      <div className="fos-stat-grid fos-stat-grid-wide">
        {[
          ["Current status", home?.summary.institutionStatus || "—"],
          ["Public corpus", home?.current.publicCorpus || "—"],
          ["Deferred", home?.current.deferredTopics ?? "—"],
          ["Scheduled retries", home?.current.scheduledRetries ?? "—"],
          ["Due retries", home?.current.dueRetries ?? "—"],
          ["Delivery failures", home?.current.terminalDeliveryFailures ?? "—"]
        ].map(([label, value]) => <div className="fos-metric" key={label}><strong className={`fos-stat ${value === "Healthy" ? "fos-status-success" : value === "Critical" ? "fos-status-danger" : ""}`}>{value}</strong><span className="small muted">{label}</span></div>)}
      </div>
      <div className="fos-mode-summary"><span className="small muted">Checked</span><strong>{home?.current.assessedAt ? formatOperationalTime(home.current.assessedAt) : "—"}</strong><span className="small muted">Current status is read-only and does not start discovery, research, governance, or publication.</span></div>
    </section>
    <section className="glass section-card stack fos-add-topics">
      <span className="eyebrow">Legacy Factory Archive</span><h2 style={{ margin: 0 }}>Historical operational evidence</h2>
      <p className="muted">The legacy Factory is {home?.legacy.factoryStatus.toLowerCase() || "unavailable"} and remains preserved, read-only, and excluded from current public-corpus health.</p>
      <div className="fos-stat-grid fos-stat-grid-wide">
        {[["Records", home?.legacy.recordCount ?? "—"], ["Historical inbox", home?.legacy.inboxCount ?? "—"], ["Dead letters", home?.legacy.failedTopics ?? "—"], ["Last activity", home?.legacy.mostRecentActivityAt ? formatOperationalTime(home.legacy.mostRecentActivityAt) : "—"]].map(([label, value]) => <div className="fos-metric" key={label}><strong className="fos-stat">{value}</strong><span className="small muted">{label}</span></div>)}
      </div>
    </section>
    <section className="glass section-card">
      <span className="eyebrow">Terminal Enqueue Failures</span>
      <h2>Delivery work requiring operational investigation</h2>
      <p className="muted">This bounded, read-only record confirms terminal delivery exhaustion. It does not permit dispatch, retry, reprioritization, re-entry, or historical-state changes.</p>
      <div className="stack">
        {factoryOperationalAvailability ? <div className="fos-empty-state" role="status" aria-live="polite"><strong>Operational record temporarily unavailable.</strong><p className="muted">{factoryOperationalAvailability}</p><button className="button secondary" type="button" disabled={pendingAction !== null} onClick={() => void load()}>Retry operational read</button></div> : generationEnqueueFailures === null || generationEnqueueFailures.length === 0 ? <p className="muted">No terminal generation enqueue failures are currently recorded.</p> : generationEnqueueFailures.map((failure) => <article className="fos-list-card" key={failure.jobId}>
          <div><strong>{failure.origin === "user" ? "Visitor-requested topic" : "Autonomous topic"}</strong><p className="small muted">Generation {failure.generation} · delivery retries {failure.enqueueRetryCount} · failed {formatOperationalTime(failure.failedAt)}</p><p className="small muted">Delivery diagnostic recorded: {failure.lastErrorPresent ? "yes" : "no"}. Diagnostic content is retained server-side.</p></div>
          <span className="pill">Delivery failed</span>
        </article>)}
      </div>
    </section>
    <section className="glass section-card">
      <span className="eyebrow">Historical Alerts</span><h2>Legacy observations</h2>
      <p className="muted">These archived alerts do not describe current V2/public-corpus health and cannot be acted on from this page.</p>
      {home?.legacy.alerts.length ? home.legacy.alerts.map((alert, index) => <article className="fos-list-card" key={`${alert.lastObservedAt}:${index}`}><div><strong>{alert.severity === "critical" ? "Critical historical observation" : "Historical observation"}</strong><p className="small muted">{alert.message}</p><p className="small muted">Last observed {formatOperationalTime(alert.lastObservedAt)}</p></div><span className="pill">Archived</span></article>) : <div className="fos-empty-state"><strong>No historical alerts are recorded.</strong></div>}
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
    {factoryOperationalAvailability ? <section className="glass section-card fos-empty-state" role="status" aria-live="polite"><strong>Factory V2 operational records are temporarily unavailable.</strong><p className="muted">{factoryOperationalAvailability} Core Factory controls and their current state remain available. No V2 work was changed.</p><button className="button secondary" type="button" disabled={pendingAction !== null} onClick={() => void load()}>Retry operational read</button></section> : null}
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
    <section className="glass section-card">
      <span className="eyebrow">Generation Retry Queue</span>
      <h2>Ready work recovering from delivery failure</h2>
      <p className="muted">This is a bounded, scheduler-owned view. Operators cannot dispatch, reprioritize, or alter retry work here.</p>
      <p className="small muted">Scheduled: {generationRetryHealth?.scheduledCount ?? "—"} · due now: {generationRetryHealth?.dueCount ?? "—"}{generationRetryHealth?.oldestDueAt ? ` · oldest due ${formatOperationalTime(generationRetryHealth.oldestDueAt)}` : ""}</p>
      <div className="stack">
        {generationRetries === null ? <p className="muted">Generation retry records are temporarily unavailable.</p> : generationRetries.length === 0 ? <p className="muted">No generation retries are currently scheduled.</p> : generationRetries.map((retry) => <article className="fos-list-card" key={retry.jobId}>
          <div><strong>{retry.origin === "user" ? "Visitor-requested topic" : "Autonomous topic"}</strong><p className="small muted">Generation {retry.generation} · delivery retries {retry.enqueueRetryCount} · next retry {formatOperationalTime(retry.nextRetryAt)} · updated {formatOperationalTime(retry.updatedAt)}</p><p className="small muted">Last delivery issue recorded: {retry.lastErrorPresent ? "yes" : "no"}. Diagnostic content is retained server-side.</p></div>
          <span className="pill">Retry scheduled</span>
        </article>)}
      </div>
    </section>
    <section className="glass section-card">
      <span className="eyebrow">Deferred Evidence Work</span>
      <h2>Topics awaiting a governed change</h2>
      <p className="muted">Deferred research preserves its evidence boundary and does not retry until the recorded condition changes.</p>
      <div className="stack">
        {deferredV2Topics === null ? <p className="muted">Deferred-work records are temporarily unavailable.</p> : deferredV2Topics.length === 0 ? <p className="muted">No Authority-First topics are currently deferred.</p> : deferredV2Topics.map((topic) => <article className="fos-list-card" key={topic.runId}>
          <div>
            <strong>{topic.outcome.classification.replaceAll("_", " ")}</strong>
            <p className="small muted">Stage {topic.stage.replaceAll("_", " ")} · {topic.outcome.detailedReason.replaceAll("_", " ")} · updated {formatOperationalTime(topic.updatedAt)}</p>
            <p className="small muted">Re-entry: {topic.outcome.reentryState === "REQUIRES_RELEVANT_CHANGE" ? "A relevant eligible-evidence change is required." : "An authorized bounded retry is required."}</p>
            <p className="small muted">Operational signal: {topic.operationalFeasibility.requiredCondition === "RELEVANT_EVIDENCE_CHANGE" ? "Awaiting a newly available eligible source." : "Awaiting a documented retry authorization."} Previous attempts: {topic.operationalFeasibility.attemptsConsumed}.</p>
            {topic.reentryRequests.length > 0 ? <div className="stack" style={{ marginTop: "0.75rem" }}><p className="small muted">Bounded re-entry history</p>{topic.reentryRequests.map((request) => <p className="small muted" key={request.requestId}>Request {request.requestId} ({request.trigger === "AUTHORIZED_RETRY" ? "authorized retry" : "relevant evidence change"}) recorded {formatOperationalTime(request.requestedAt)}: {request.state === "CONSUMED" ? ` consumed into queued run ${request.queuedRunId} at ${request.consumedAt ? formatOperationalTime(request.consumedAt) : "an unknown time"}.` : " pending. This view cannot consume, dispatch, or start research."}</p>)}</div> : null}
            {topic.operationalFeasibility.requiredCondition === "RELEVANT_EVIDENCE_CHANGE" ? <div className="admin-action-row"><button className="button secondary" disabled={pendingAction !== null} onClick={() => setSourceSubmission({ operationId: topic.runId, url: "", rationale: "" })}>Submit Source Candidate</button></div> : null}
            {topic.operationalFeasibility.requiredCondition === "AUTHORIZED_RETRY" ? <div className="stack" style={{ marginTop: "0.75rem" }}>
              {deferredReentryRequests[topic.runId] ? <p className="small muted">Bounded retry request {deferredReentryRequests[topic.runId]!.state === "CREATED" ? "recorded" : "already recorded"}: {deferredReentryRequests[topic.runId]!.requestId}. It remains a request only; it does not dispatch or start research.</p> : null}
              {authorizedRetry?.operationId !== topic.runId ? <div className="admin-action-row"><button className="button secondary" disabled={pendingAction !== null} onClick={() => setAuthorizedRetry({ operationId: topic.runId, reason: "" })}>Record bounded retry authorization</button></div> : <>
                <label className="small">Why this bounded retry is authorized<textarea value={authorizedRetry.reason} maxLength={1000} onChange={(event) => setAuthorizedRetry({ ...authorizedRetry, reason: event.target.value })} rows={3} /></label>
                <div className="admin-action-row"><button className="button" disabled={pendingAction !== null || authorizedRetry.reason.trim().length < 3} onClick={() => void requestAuthorizedRetry()}>Record retry request</button><button className="button secondary" disabled={pendingAction !== null} onClick={() => setAuthorizedRetry(null)}>Cancel</button></div>
                <p className="small muted">This creates an immutable, attributable re-entry request. It does not consume the request, dispatch a worker, or start research.</p>
              </>}
            </div> : null}
            {sourceSubmission?.operationId === topic.runId ? <div className="stack" style={{ marginTop: "0.75rem" }}>
              <label className="small">Public HTTPS source URL<input value={sourceSubmission.url} onChange={(event) => setSourceSubmission({ ...sourceSubmission, url: event.target.value })} placeholder="https://…" inputMode="url" /></label>
              <label className="small">Why this may address the unresolved obligation<textarea value={sourceSubmission.rationale} onChange={(event) => setSourceSubmission({ ...sourceSubmission, rationale: event.target.value })} rows={3} /></label>
              <div className="admin-action-row"><button className="button" disabled={pendingAction !== null || sourceSubmission.url.trim().length < 8 || sourceSubmission.rationale.trim().length < 10} onClick={() => void submitSourceCandidate()}>Preserve Candidate</button><button className="button secondary" disabled={pendingAction !== null} onClick={() => setSourceSubmission(null)}>Cancel</button></div>
              <p className="small muted">This creates a candidate for Factory validation. It does not create evidence, change authority, or retry research.</p>
            </div> : null}
            {(sourceCandidates || []).filter((candidate) => candidate.operationId === topic.runId).map((candidate) => <div className="small muted stack" key={candidate.candidateId}>
              <p>Candidate awaiting Factory validation: <a href={candidate.submittedUrl} target="_blank" rel="noreferrer">{candidate.submittedUrl}</a> · submitted {formatOperationalTime(candidate.createdAt)} by {candidate.submittedBy}.</p>
              <p>Recorded rationale: {candidate.rationale}</p>
              <p>Candidate state: {candidate.state}. This is provenance only; it is not evidence, authority, a retrieval instruction, or a re-entry authorization.</p>
              <div className="admin-action-row"><button className="button secondary" disabled={inspectingCandidateId !== null} onClick={() => void inspectSourceCandidate(candidate.candidateId)}>{inspectingCandidateId === candidate.candidateId ? "Loading recorded status…" : "View recorded Factory status"}</button></div>
              {sourceCandidateInspections[candidate.candidateId] ? <div className="small muted">
                <p>Authority validation: {sourceCandidateInspections[candidate.candidateId]!.validation ? `${sourceCandidateInspections[candidate.candidateId]!.validation!.state.replaceAll("_", " ")} · recorded ${formatOperationalTime(sourceCandidateInspections[candidate.candidateId]!.validation!.recordedAt)}` : "not recorded"}.</p>
                <p>Retrieval outcome: {sourceCandidateInspections[candidate.candidateId]!.retrieval ? `${sourceCandidateInspections[candidate.candidateId]!.retrieval!.state.replaceAll("_", " ")} · ${sourceCandidateInspections[candidate.candidateId]!.retrieval!.retrievalDisposition?.replaceAll("_", " ") || "no disposition"}${sourceCandidateInspections[candidate.candidateId]!.retrieval!.rejectionCode ? ` · ${sourceCandidateInspections[candidate.candidateId]!.retrieval!.rejectionCode}` : ""}` : "not recorded"}.</p>
                <p>Recorded status is read-only. It does not expose source content, create qualifying evidence, authorize re-entry, or dispatch retrieval.</p>
              </div> : null}
            </div>)}
          </div>
          <span className="pill">Generation {topic.generation}</span>
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
