"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminFetcher, GovernanceOperationsDataset, StatusHandlers } from "@/components/admin/admin-shared";

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
