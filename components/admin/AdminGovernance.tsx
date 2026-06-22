"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminFetcher, GovernanceOperationsDataset, StatusHandlers } from "@/components/admin/admin-shared";

type GovernanceActorRole =
  | "factory_editor"
  | "governance_reviewer"
  | "senior_governance_reviewer"
  | "library_editor"
  | "registry_operator"
  | "auditor";

type GovernancePackage = NonNullable<GovernanceOperationsDataset>["publicationPackages"][number];
type GovernanceFeedback = NonNullable<GovernanceOperationsDataset>["feedbackPackages"][number];

type ViewKey =
  | "dashboard"
  | "packages"
  | "decisions"
  | "feedback"
  | "revisions"
  | "retirements"
  | "merges"
  | "preservations"
  | "continuity"
  | "audit";

const views: Array<{ key: ViewKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "packages", label: "Publication Packages" },
  { key: "decisions", label: "Decisions" },
  { key: "feedback", label: "Feedback" },
  { key: "revisions", label: "Revisions" },
  { key: "retirements", label: "Retirements" },
  { key: "merges", label: "Merges" },
  { key: "preservations", label: "Preservations" },
  { key: "continuity", label: "Continuity" },
  { key: "audit", label: "Audit" }
];

type GovernanceActionKind =
  | "CERTIFY_PUBLICATION_READINESS"
  | "ACCEPT_PUBLICATION_PACKAGE"
  | "REJECT_PUBLICATION_PACKAGE"
  | "RETURN_FOR_REVISION"
  | "ACKNOWLEDGE_FEEDBACK_PACKAGE"
  | "RESOLVE_FEEDBACK_PACKAGE";

type GovernanceActionTarget = {
  id: string;
  label: string;
  currentLifecycle: string;
  nextLifecycle: string;
  endpoint: string;
  action: GovernanceActionKind;
  requiresDecision: boolean;
  impact: string[];
};

const roleOptions: GovernanceActorRole[] = [
  "governance_reviewer",
  "senior_governance_reviewer",
  "library_editor",
  "auditor",
  "factory_editor",
  "registry_operator"
];

function shortId(value?: string | null) {
  if (!value) {
    return "none";
  }
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function statusClass(value?: string | null) {
  if (!value) {
    return "pill";
  }
  if (["approved", "accepted", "published", "resolved", "closed", "ready"].includes(value)) {
    return "pill success";
  }
  if (["rejected", "returned_for_revision", "blocking", "blocked"].includes(value)) {
    return "pill danger";
  }
  return "pill";
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="admin-json">{JSON.stringify(value, null, 2)}</pre>;
}

function EmptyState({ label }: { label: string }) {
  return (
    <section className="glass section-card">
      <p className="muted" style={{ margin: 0 }}>
        No {label} found in the current operations snapshot.
      </p>
    </section>
  );
}

function packageActions(item: GovernancePackage): GovernanceActionTarget[] {
  const base = `/api/admin/governance/publication-packages/${item.packageId}`;
  const actions: GovernanceActionTarget[] = [];
  if (item.lifecycle === "governance_review") {
    actions.push({
      id: item.packageId,
      label: "Certify readiness",
      currentLifecycle: item.lifecycle,
      nextLifecycle: "readiness_certified",
      endpoint: `${base}/certify-readiness`,
      action: "CERTIFY_PUBLICATION_READINESS",
      requiresDecision: true,
      impact: [
        "Records Governance readiness certification.",
        "Links the approved readiness decision to the package.",
        "Creates an audit transition for the package lifecycle."
      ]
    });
    actions.push({
      id: item.packageId,
      label: "Reject",
      currentLifecycle: item.lifecycle,
      nextLifecycle: "rejected",
      endpoint: `${base}/reject`,
      action: "REJECT_PUBLICATION_PACKAGE",
      requiresDecision: false,
      impact: [
        "Stops the publication package from continuing to Library review.",
        "Records rejection as the package acceptance outcome.",
        "Creates an audit transition for the package lifecycle."
      ]
    });
    actions.push({
      id: item.packageId,
      label: "Return",
      currentLifecycle: item.lifecycle,
      nextLifecycle: "returned_for_revision",
      endpoint: `${base}/return`,
      action: "RETURN_FOR_REVISION",
      requiresDecision: false,
      impact: [
        "Returns the package to Factory revision flow.",
        "Preserves lineage through the existing publication package id.",
        "Creates an audit transition for the package lifecycle."
      ]
    });
  }
  if (item.lifecycle === "library_review") {
    actions.push({
      id: item.packageId,
      label: "Accept",
      currentLifecycle: item.lifecycle,
      nextLifecycle: "accepted",
      endpoint: `${base}/accept`,
      action: "ACCEPT_PUBLICATION_PACKAGE",
      requiresDecision: true,
      impact: [
        "Marks the package accepted by Governance for Library admission.",
        "Requires prior readiness certification and an approved acceptance decision.",
        "Creates an audit transition for the package lifecycle."
      ]
    });
    actions.push({
      id: item.packageId,
      label: "Reject",
      currentLifecycle: item.lifecycle,
      nextLifecycle: "rejected",
      endpoint: `${base}/reject`,
      action: "REJECT_PUBLICATION_PACKAGE",
      requiresDecision: false,
      impact: [
        "Rejects the package during Library review.",
        "Prevents publication admission through this package.",
        "Creates an audit transition for the package lifecycle."
      ]
    });
    actions.push({
      id: item.packageId,
      label: "Return",
      currentLifecycle: item.lifecycle,
      nextLifecycle: "returned_for_revision",
      endpoint: `${base}/return`,
      action: "RETURN_FOR_REVISION",
      requiresDecision: false,
      impact: [
        "Returns the package for revision from Library review.",
        "Keeps Governance as the workflow authority.",
        "Creates an audit transition for the package lifecycle."
      ]
    });
  }
  return actions;
}

function feedbackActions(item: GovernanceFeedback): GovernanceActionTarget[] {
  const base = `/api/admin/governance/feedback-packages/${item.feedbackPackageId}`;
  const actions: GovernanceActionTarget[] = [];
  if (item.lifecycle === "delivered_to_factory") {
    actions.push({
      id: item.feedbackPackageId,
      label: "Acknowledge",
      currentLifecycle: item.lifecycle,
      nextLifecycle: "acknowledged",
      endpoint: `${base}/acknowledge`,
      action: "ACKNOWLEDGE_FEEDBACK_PACKAGE",
      requiresDecision: false,
      impact: [
        "Records Factory-facing acknowledgement.",
        "Keeps feedback handling inside Governance workflow.",
        "Creates an audit transition for the feedback package."
      ]
    });
  }
  if (item.lifecycle === "factory_reviewing" || item.lifecycle === "action_required") {
    actions.push({
      id: item.feedbackPackageId,
      label: "Resolve",
      currentLifecycle: item.lifecycle,
      nextLifecycle: "resolved",
      endpoint: `${base}/resolve`,
      action: "RESOLVE_FEEDBACK_PACKAGE",
      requiresDecision: false,
      impact: [
        "Marks the feedback package resolved.",
        "Preserves affected authority references and feedback lineage.",
        "Creates an audit transition for the feedback package."
      ]
    });
  }
  return actions;
}

export function AdminGovernance({
  token,
  fetchAdmin,
  statusHandlers
}: {
  token: string;
  fetchAdmin: AdminFetcher;
  statusHandlers: StatusHandlers;
}) {
  const [dataset, setDataset] = useState<GovernanceOperationsDataset>(null);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [actorId, setActorId] = useState("admin");
  const [actorRole, setActorRole] = useState<GovernanceActorRole>("governance_reviewer");
  const [institutionId, setInstitutionId] = useState("governance");
  const [reason, setReason] = useState("");
  const [governanceDecisionId, setGovernanceDecisionId] = useState("");
  const [pendingAction, setPendingAction] = useState<GovernanceActionTarget | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  useEffect(() => {
    if (!token) {
      setDataset(null);
      return;
    }

    let cancelled = false;
    statusHandlers.setStatus("Loading governance operations.");
    statusHandlers.setError("");

    fetchAdmin<NonNullable<GovernanceOperationsDataset>>("/api/admin/governance/operations")
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setDataset(snapshot);
        statusHandlers.setStatus(`Governance operations loaded at ${new Date(snapshot.generatedAt).toLocaleString()}.`);
        statusHandlers.onLoaded();
      })
      .catch((error: Error) => {
        if (!cancelled) {
          statusHandlers.setError(error.message);
          statusHandlers.setStatus("Governance operations unavailable.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchAdmin, statusHandlers, token]);

  async function refreshOperationsSnapshot(message = "Governance operations refreshed.") {
    const snapshot = await fetchAdmin<NonNullable<GovernanceOperationsDataset>>("/api/admin/governance/operations");
    setDataset(snapshot);
    statusHandlers.setStatus(message);
    statusHandlers.onLoaded();
  }

  function openAction(action: GovernanceActionTarget) {
    setPendingAction(action);
    setReason("");
    setGovernanceDecisionId("");
    statusHandlers.setError("");
  }

  async function executePendingAction() {
    if (!pendingAction) {
      return;
    }
    setIsSubmittingAction(true);
    statusHandlers.setError("");
    statusHandlers.setStatus(`Executing ${pendingAction.action}.`);
    try {
      await fetchAdmin(pendingAction.endpoint, {
        method: "POST",
        body: JSON.stringify({
          actor: {
            actorId,
            role: actorRole,
            institutionId
          },
          reason,
          governanceDecisionId: pendingAction.requiresDecision ? governanceDecisionId : undefined
        })
      });
      const completed = pendingAction;
      setPendingAction(null);
      await refreshOperationsSnapshot(`${completed.action} completed for ${shortId(completed.id)}.`);
    } catch (error) {
      statusHandlers.setError(error instanceof Error ? error.message : "Governance action failed.");
      statusHandlers.setStatus("Governance action failed.");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  const lifecycleValues = useMemo(() => {
    if (!dataset) {
      return ["all"];
    }
    const values = new Set<string>(["all"]);
    for (const item of [
      ...dataset.publicationPackages,
      ...dataset.governanceDecisions,
      ...dataset.feedbackPackages
    ]) {
      values.add(item.lifecycle);
    }
    return Array.from(values);
  }, [dataset]);

  const filteredPackages = useMemo(() => {
    const packages = dataset?.publicationPackages || [];
    return lifecycleFilter === "all" ? packages : packages.filter((item) => item.lifecycle === lifecycleFilter);
  }, [dataset, lifecycleFilter]);

  const filteredDecisions = useMemo(() => {
    const decisions = dataset?.governanceDecisions || [];
    return lifecycleFilter === "all" ? decisions : decisions.filter((item) => item.lifecycle === lifecycleFilter);
  }, [dataset, lifecycleFilter]);

  const filteredFeedback = useMemo(() => {
    const feedback = dataset?.feedbackPackages || [];
    return lifecycleFilter === "all" ? feedback : feedback.filter((item) => item.lifecycle === lifecycleFilter);
  }, [dataset, lifecycleFilter]);

  const canConfirmAction = useMemo(() => {
    if (!pendingAction) {
      return false;
    }
    if (actorId.trim().length < 2 || institutionId.trim().length < 2 || reason.trim().length < 3) {
      return false;
    }
    if (pendingAction.requiresDecision && !governanceDecisionId.trim()) {
      return false;
    }
    return !isSubmittingAction;
  }, [actorId, governanceDecisionId, institutionId, isSubmittingAction, pendingAction, reason]);

  if (!token) {
    return (
      <section className="glass section-card">
        <span className="eyebrow">Governance operations</span>
        <p className="muted" style={{ margin: 0 }}>
          Enter the admin API token to load Governance and Historical Library operational state.
        </p>
      </section>
    );
  }

  if (!dataset) {
    return (
      <section className="glass section-card">
        <span className="eyebrow">Governance operations</span>
        <p className="muted" style={{ margin: 0 }}>
          Loading operations snapshot.
        </p>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="glass section-card stack">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Governance operations</span>
            <h2>Institutional workflow visibility</h2>
          </div>
          <select className="input compact-input" value={lifecycleFilter} onChange={(event) => setLifecycleFilter(event.target.value)}>
            {lifecycleValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-subnav">
          {views.map((view) => (
            <button
              key={view.key}
              type="button"
              className={`button admin-subtab ${activeView === view.key ? "admin-subtab-active" : ""}`}
              onClick={() => setActiveView(view.key)}
            >
              {view.label}
            </button>
          ))}
        </div>
      </section>

      <section className="glass section-card stack">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Operator controls</span>
            <h3>Service-mediated Governance actions</h3>
          </div>
          <span className="pill">admin authenticated</span>
        </div>
        <div className="grid three-col">
          <label className="form-field">
            <span>Actor ID</span>
            <input className="input" value={actorId} onChange={(event) => setActorId(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Role</span>
            <select className="input" value={actorRole} onChange={(event) => setActorRole(event.target.value as GovernanceActorRole)}>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Institution</span>
            <input className="input" value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} />
          </label>
        </div>
      </section>

      {pendingAction ? (
        <section className="glass section-card stack">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Decision confirmation</span>
              <h3>{pendingAction.action}</h3>
            </div>
            <span className={statusClass(pendingAction.nextLifecycle)}>{pendingAction.currentLifecycle} {"->"} {pendingAction.nextLifecycle}</span>
          </div>
          <div className="grid two-col">
            <div className="stack">
              <strong>Impact preview</strong>
              {pendingAction.impact.map((impact) => (
                <p key={impact} className="small muted" style={{ margin: 0 }}>
                  {impact}
                </p>
              ))}
            </div>
            <div className="stack">
              {pendingAction.requiresDecision ? (
                <label className="form-field">
                  <span>Approved GovernanceDecision ID</span>
                  <input
                    className="input"
                    value={governanceDecisionId}
                    onChange={(event) => setGovernanceDecisionId(event.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                  />
                </label>
              ) : null}
              <label className="form-field">
                <span>Audit reason</span>
                <textarea className="input" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
              </label>
              <div className="button-row">
                <button className="button" type="button" onClick={() => setPendingAction(null)} disabled={isSubmittingAction}>
                  Cancel
                </button>
                <button className="button primary" type="button" onClick={executePendingAction} disabled={!canConfirmAction}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeView === "dashboard" ? (
        <section className="grid two-col">
          {[
            ["Publication Packages", dataset.publicationPackages.length],
            ["Governance Decisions", dataset.governanceDecisions.length],
            ["Feedback Packages", dataset.feedbackPackages.length],
            ["Audit Records", dataset.auditRecords.length],
            ["Library Revisions", dataset.historicalLibrary.revisions.length],
            ["Continuity Links", dataset.historicalLibrary.merges.length + dataset.historicalLibrary.feedbackLinks.length]
          ].map(([label, value]) => (
            <article key={label} className="glass section-card">
              <span className="eyebrow">{label}</span>
              <strong className="metric-value">{value}</strong>
            </article>
          ))}
        </section>
      ) : null}

      {activeView === "packages" ? (
        filteredPackages.length ? (
          <section className="stack">
            {filteredPackages.map((item) => (
              <article key={item.packageId} className="glass section-card stack">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{shortId(item.packageId)}</span>
                    <h3>{item.scope.packageType}</h3>
                  </div>
                  <span className={statusClass(item.lifecycle)}>{item.lifecycle}</span>
                </div>
                <p className="muted">{item.scope.description}</p>
                <div className="grid two-col">
                  <div>
                    <strong>Factory lineage</strong>
                    <p className="small muted">Version {shortId(item.factorySubmission?.factoryPackageVersionId)}</p>
                    <p className="small muted">Draft {shortId(item.factorySubmission?.factoryPackageDraftId)}</p>
                    <p className="small muted">Root {shortId(item.factorySubmission?.factoryLineageRootId)}</p>
                  </div>
                  <div>
                    <strong>Governance decisions</strong>
                    <p className="small muted">{item.decisionRefs.map(shortId).join(", ") || "none"}</p>
                    <p className="small muted">Acceptance {item.acceptanceOutcome || "pending"}</p>
                  </div>
                </div>
                <div className="button-row">
                  {packageActions(item).length ? (
                    packageActions(item).map((action) => (
                      <button key={action.action} className="button" type="button" onClick={() => openAction(action)}>
                        {action.label}
                      </button>
                    ))
                  ) : (
                    <span className="small muted">No lifecycle actions available.</span>
                  )}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <EmptyState label="publication packages" />
        )
      ) : null}

      {activeView === "decisions" ? (
        filteredDecisions.length ? (
          <section className="stack">
            {filteredDecisions.map((item) => (
              <article key={item.decisionId} className="glass section-card stack">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{shortId(item.decisionId)}</span>
                    <h3>{item.decisionType}</h3>
                  </div>
                  <span className={statusClass(item.lifecycle)}>{item.lifecycle}</span>
                </div>
                <p className="muted">{item.rationale.summary}</p>
                <p className="small muted">
                  Target {item.targetAuthority.authorityType}: {shortId(item.targetAuthority.authorityId)}
                </p>
              </article>
            ))}
          </section>
        ) : (
          <EmptyState label="governance decisions" />
        )
      ) : null}

      {activeView === "feedback" ? (
        filteredFeedback.length ? (
          <section className="stack">
            {filteredFeedback.map((item) => (
              <article key={item.feedbackPackageId} className="glass section-card stack">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{shortId(item.feedbackPackageId)}</span>
                    <h3>{item.correctionClass}</h3>
                  </div>
                  <span className={statusClass(item.lifecycle)}>{item.lifecycle}</span>
                </div>
                <p className="small muted">Severity {item.severity}. Response {item.requiredResponse}.</p>
                <p className="small muted">Source package {shortId(item.origin.sourcePackageId)}</p>
                <div className="button-row">
                  {feedbackActions(item).length ? (
                    feedbackActions(item).map((action) => (
                      <button key={action.action} className="button" type="button" onClick={() => openAction(action)}>
                        {action.label}
                      </button>
                    ))
                  ) : (
                    <span className="small muted">No lifecycle actions available.</span>
                  )}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <EmptyState label="feedback packages" />
        )
      ) : null}

      {activeView === "revisions" ? (
        dataset.historicalLibrary.revisions.length ? (
          <section className="stack">
            {dataset.historicalLibrary.revisions.map((item) => (
              <article key={item.revisionId} className="glass section-card stack">
                <span className="eyebrow">Revision {shortId(item.revisionId)}</span>
                <h3>{item.amendmentSummary}</h3>
                <p className="small muted">Snapshot {shortId(item.publishedSnapshotId)}. Decision {shortId(item.governanceDecisionId)}.</p>
                <JsonBlock value={item.revisedSnapshot} />
              </article>
            ))}
          </section>
        ) : (
          <EmptyState label="revisions" />
        )
      ) : null}

      {activeView === "retirements" ? (
        dataset.historicalLibrary.retirements.length ? (
          <section className="stack">
            {dataset.historicalLibrary.retirements.map((item) => (
              <article key={item.retirementId} className="glass section-card stack">
                <span className="eyebrow">Retirement {shortId(item.retirementId)}</span>
                <h3>{item.retirementReason}</h3>
                <p className="small muted">Snapshot {shortId(item.publishedSnapshotId)} remains resolvable.</p>
                <JsonBlock value={item.continuityPath} />
              </article>
            ))}
          </section>
        ) : (
          <EmptyState label="retirements" />
        )
      ) : null}

      {activeView === "merges" || activeView === "continuity" ? (
        dataset.historicalLibrary.merges.length || dataset.historicalLibrary.feedbackLinks.length ? (
          <section className="stack">
            {dataset.historicalLibrary.merges.map((item) => (
              <article key={item.mergeId} className="glass section-card stack">
                <span className="eyebrow">Merge {shortId(item.mergeId)}</span>
                <h3>{item.mergeReason}</h3>
                <p className="small muted">
                  Source {shortId(item.sourcePublishedRecordId)} {"->"} Target {shortId(item.targetPublishedRecordId)}
                </p>
                <JsonBlock value={item.continuityPath} />
              </article>
            ))}
            {activeView === "continuity"
              ? dataset.historicalLibrary.feedbackLinks.map((item) => (
                  <article key={item.feedbackLinkId} className="glass section-card">
                    <span className="eyebrow">Feedback continuity</span>
                    <p className="small muted" style={{ margin: 0 }}>
                      {item.lifecycleActionType} {shortId(item.lifecycleActionId)} {"->"} Feedback {shortId(item.feedbackPackageId)}
                    </p>
                  </article>
                ))
              : null}
          </section>
        ) : (
          <EmptyState label="continuity records" />
        )
      ) : null}

      {activeView === "preservations" ? (
        dataset.historicalLibrary.preservations.length ? (
          <section className="stack">
            {dataset.historicalLibrary.preservations.map((item) => (
              <article key={item.preservationId} className="glass section-card stack">
                <span className="eyebrow">Preservation {shortId(item.preservationId)}</span>
                <h3>{item.preservationReason}</h3>
                <JsonBlock value={item.preservationMetadata} />
              </article>
            ))}
          </section>
        ) : (
          <EmptyState label="preservation records" />
        )
      ) : null}

      {activeView === "audit" ? (
        dataset.auditRecords.length ? (
          <section className="stack">
            {dataset.auditRecords.map((item) => (
              <article key={item.auditRecordId} className="glass section-card stack">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Audit {shortId(item.auditRecordId)}</span>
                    <h3>{item.finalState}</h3>
                  </div>
                  <span className="pill">{item.authorityRef.authorityType}</span>
                </div>
                <p className="small muted">Authority {shortId(item.authorityRef.authorityId)}</p>
                <JsonBlock value={item.reconstruction} />
              </article>
            ))}
          </section>
        ) : (
          <EmptyState label="audit records" />
        )
      ) : null}
    </div>
  );
}
