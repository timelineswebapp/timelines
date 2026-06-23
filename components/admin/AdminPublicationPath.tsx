"use client";

import { useMemo, useState } from "react";
import type { AdminFetcher, StatusHandlers } from "@/components/admin/admin-shared";

type ActionMethod = "GET" | "POST" | "PUT";

type ActionDefinition = {
  key: string;
  label: string;
  method: ActionMethod;
  endpoint: string;
  body: string;
  idField?: {
    label: string;
    placeholder: string;
    replace: string;
  };
};

const actor = "telephone-operator";
const governanceActor = {
  actorId: "telephone-operator",
  role: "factory_editor",
  institutionId: "factory"
};
const governanceReviewer = {
  actorId: "telephone-governance",
  role: "governance_reviewer",
  institutionId: "governance"
};
const libraryActor = {
  actorId: "telephone-library",
  role: "library_editor",
  institutionId: "historical_library"
};

const factoryActions: ActionDefinition[] = [
  {
    key: "factory-pipelines",
    label: "List Factory pipelines",
    method: "GET",
    endpoint: "/api/admin/factory/runtime/pipelines",
    body: ""
  },
  {
    key: "factory-start-pipeline",
    label: "Start Telephone publication candidate pipeline",
    method: "POST",
    endpoint: "/api/admin/factory/runtime/pipelines/runs",
    body: JSON.stringify(
      {
        pipelineId: "publication_candidate_pipeline",
        input: {
          subject: "Telephone"
        },
        actor,
        reason: "Prepare Telephone for institutional publication."
      },
      null,
      2
    )
  },
  {
    key: "factory-runs",
    label: "List Factory pipeline runs",
    method: "GET",
    endpoint: "/api/admin/factory/runtime/pipelines/runs",
    body: ""
  },
  {
    key: "factory-validate",
    label: "Validate candidate package",
    method: "POST",
    endpoint: "/api/admin/factory/editorial/reviews",
    body: JSON.stringify(
      {
        factoryPackageDraftId: "",
        reviewer: actor,
        evidenceReviewed: [{ subject: "Telephone" }],
        sourcesReviewed: [{ subject: "Telephone" }],
        validationSummary: {
          minimumSourceCount: 1,
          minimumEvidenceCount: 1,
          sourceDiversity: true,
          dateConsistency: true,
          chronologyConsistency: true,
          relationshipConsistency: true,
          objectIdentityConsistency: true
        },
        actor,
        reason: "Validate Telephone candidate package for Governance handoff."
      },
      null,
      2
    )
  },
  {
    key: "factory-approve-review",
    label: "Approve editorial review",
    method: "POST",
    endpoint: "/api/admin/factory/editorial/decisions?reviewId={reviewId}",
    idField: {
      label: "Review ID",
      placeholder: "Factory editorial review UUID",
      replace: "{reviewId}"
    },
    body: JSON.stringify(
      {
        decision: "approve",
        confidence: {
          confidenceLevel: "verified",
          confidenceScore: 0.9,
          factors: {
            sourceQuality: 0.9,
            sourceCount: 0.9,
            evidenceCount: 0.9,
            crossSourceAgreement: 0.9,
            chronologicalConsistency: 0.9
          }
        },
        actor,
        reason: "Approve Telephone candidate package for authority preparation."
      },
      null,
      2
    )
  },
  {
    key: "factory-authority",
    label: "Prepare authority records",
    method: "POST",
    endpoint: "/api/admin/factory/editorial/authority-preparation",
    body: JSON.stringify(
      {
        editorialReviewId: "",
        canonicalIdentityMapping: { subject: "Telephone" },
        authorityReferences: { subject: "Telephone" },
        sourceTraceability: { subject: "Telephone" },
        evidenceTraceability: { subject: "Telephone" },
        revisionTraceability: { subject: "Telephone" },
        actor,
        reason: "Prepare Telephone authority records for Governance readiness."
      },
      null,
      2
    )
  },
  {
    key: "factory-readiness",
    label: "Assess Governance readiness",
    method: "PUT",
    endpoint: "/api/admin/factory/editorial/authority-preparation",
    body: JSON.stringify(
      {
        editorialReviewId: "",
        actor,
        reason: "Assess Telephone package as ready for Governance."
      },
      null,
      2
    )
  },
  {
    key: "factory-draft-validating",
    label: "Mark package draft validating",
    method: "POST",
    endpoint: "/api/admin/factory/package-drafts/{packageDraftId}/transition",
    idField: {
      label: "Package Draft ID",
      placeholder: "Factory package draft UUID",
      replace: "{packageDraftId}"
    },
    body: JSON.stringify(
      {
        lifecycle: "validating",
        actor,
        reason: "Move Telephone package draft into validation lifecycle."
      },
      null,
      2
    )
  },
  {
    key: "factory-draft-ready",
    label: "Mark package draft ready",
    method: "POST",
    endpoint: "/api/admin/factory/package-drafts/{packageDraftId}/transition",
    idField: {
      label: "Package Draft ID",
      placeholder: "Factory package draft UUID",
      replace: "{packageDraftId}"
    },
    body: JSON.stringify(
      {
        lifecycle: "ready_for_governance",
        actor,
        reason: "Move Telephone package draft to Governance-ready lifecycle."
      },
      null,
      2
    )
  },
  {
    key: "factory-handoff",
    label: "Prepare Governance handoff",
    method: "POST",
    endpoint: "/api/admin/factory/handoffs",
    body: JSON.stringify(
      {
        pipelineRunId: null,
        factoryPackageDraftId: "",
        actor,
        reason: "Prepare Telephone Governance handoff."
      },
      null,
      2
    )
  },
  {
    key: "factory-submit-handoff",
    label: "Submit handoff to Governance",
    method: "POST",
    endpoint: "/api/admin/factory/handoffs/{handoffId}/submit",
    idField: {
      label: "Handoff ID",
      placeholder: "Factory handoff UUID",
      replace: "{handoffId}"
    },
    body: JSON.stringify(
      {
        actor: governanceActor,
        reason: "Submit Telephone package to Governance."
      },
      null,
      2
    )
  }
];

const governanceActions: ActionDefinition[] = [
  {
    key: "governance-snapshot",
    label: "Load Governance operations",
    method: "GET",
    endpoint: "/api/admin/governance/operations",
    body: ""
  },
  {
    key: "governance-decision-readiness",
    label: "Create readiness decision",
    method: "POST",
    endpoint: "/api/admin/governance/decisions",
    body: JSON.stringify(
      {
        decisionId: "",
        decisionType: "CERTIFY_PUBLICATION_READINESS",
        targetAuthority: { authorityType: "publication_package", authorityId: "" },
        actor: governanceReviewer,
        evidenceRefs: [],
        rationale: {
          summary: "Telephone package is ready for publication.",
          authorityBasis: ["Certified Telephone evidence package."]
        },
        approvalRefs: [],
        escalationRefs: [],
        outcome: "no_action",
        lifecycle: "draft"
      },
      null,
      2
    )
  },
  {
    key: "governance-decision-acceptance",
    label: "Create acceptance decision",
    method: "POST",
    endpoint: "/api/admin/governance/decisions",
    body: JSON.stringify(
      {
        decisionId: "",
        decisionType: "ACCEPT_PUBLICATION_PACKAGE",
        targetAuthority: { authorityType: "publication_package", authorityId: "" },
        actor: governanceReviewer,
        evidenceRefs: [],
        rationale: {
          summary: "Telephone package is accepted for Historical Library admission.",
          authorityBasis: ["Governance review accepted Telephone package."]
        },
        approvalRefs: [],
        escalationRefs: [],
        outcome: "no_action",
        lifecycle: "draft"
      },
      null,
      2
    )
  },
  {
    key: "governance-approval",
    label: "Create approval chain",
    method: "POST",
    endpoint: "/api/admin/governance/approvals",
    body: JSON.stringify(
      {
        approvalId: "",
        decisionId: "",
        request: {
          requestedBy: governanceReviewer,
          requestedRole: "senior_governance_reviewer",
          targetAuthority: { authorityType: "publication_package", authorityId: "" },
          reason: "Approve Telephone Governance decision."
        },
        steps: [
          {
            stepId: "",
            sequence: 1,
            requiredRole: "senior_governance_reviewer"
          }
        ],
        lifecycle: "pending"
      },
      null,
      2
    )
  },
  {
    key: "governance-approve-step",
    label: "Approve approval step",
    method: "POST",
    endpoint: "/api/admin/governance/approvals/{approvalId}/approve-step",
    idField: {
      label: "Approval ID",
      placeholder: "Approval UUID",
      replace: "{approvalId}"
    },
    body: JSON.stringify(
      {
        stepId: "",
        actor: { actorId: "telephone-senior-governance", role: "senior_governance_reviewer", institutionId: "governance" },
        reason: "Approve Telephone Governance decision step."
      },
      null,
      2
    )
  },
  {
    key: "governance-complete-approval",
    label: "Complete approval chain",
    method: "POST",
    endpoint: "/api/admin/governance/approvals/{approvalId}/complete-chain",
    idField: {
      label: "Approval ID",
      placeholder: "Approval UUID",
      replace: "{approvalId}"
    },
    body: JSON.stringify(
      {
        actor: { actorId: "telephone-senior-governance", role: "senior_governance_reviewer", institutionId: "governance" },
        reason: "Complete Telephone approval chain."
      },
      null,
      2
    )
  },
  {
    key: "governance-submit-decision",
    label: "Submit decision",
    method: "POST",
    endpoint: "/api/admin/governance/decisions/{decisionId}/submit",
    idField: {
      label: "Decision ID",
      placeholder: "GovernanceDecision UUID",
      replace: "{decisionId}"
    },
    body: JSON.stringify({ actor: governanceReviewer, reason: "Submit Telephone Governance decision." }, null, 2)
  },
  {
    key: "governance-review-decision",
    label: "Review decision",
    method: "POST",
    endpoint: "/api/admin/governance/decisions/{decisionId}/review",
    idField: {
      label: "Decision ID",
      placeholder: "GovernanceDecision UUID",
      replace: "{decisionId}"
    },
    body: JSON.stringify({ actor: governanceReviewer, reason: "Review Telephone Governance decision." }, null, 2)
  },
  {
    key: "governance-approve-decision",
    label: "Approve decision",
    method: "POST",
    endpoint: "/api/admin/governance/decisions/{decisionId}/approve",
    idField: {
      label: "Decision ID",
      placeholder: "GovernanceDecision UUID",
      replace: "{decisionId}"
    },
    body: JSON.stringify({ actor: governanceReviewer, reason: "Approve Telephone Governance decision." }, null, 2)
  },
  {
    key: "governance-certify",
    label: "Certify package readiness",
    method: "POST",
    endpoint: "/api/admin/governance/publication-packages/{packageId}/certify-readiness",
    idField: {
      label: "Publication Package ID",
      placeholder: "Governance publication package UUID",
      replace: "{packageId}"
    },
    body: JSON.stringify(
      {
        actor: governanceReviewer,
        governanceDecisionId: "",
        reason: "Certify Telephone package readiness."
      },
      null,
      2
    )
  },
  {
    key: "governance-library-review",
    label: "Submit to Library review",
    method: "POST",
    endpoint: "/api/admin/governance/publication-packages/{packageId}/submit-library-review",
    idField: {
      label: "Publication Package ID",
      placeholder: "Governance publication package UUID",
      replace: "{packageId}"
    },
    body: JSON.stringify({ actor: governanceReviewer, reason: "Submit Telephone package to Library review." }, null, 2)
  },
  {
    key: "governance-accept",
    label: "Accept package",
    method: "POST",
    endpoint: "/api/admin/governance/publication-packages/{packageId}/accept",
    idField: {
      label: "Publication Package ID",
      placeholder: "Governance publication package UUID",
      replace: "{packageId}"
    },
    body: JSON.stringify(
      {
        actor: governanceReviewer,
        governanceDecisionId: "",
        reason: "Accept Telephone package for Historical Library admission."
      },
      null,
      2
    )
  }
];

const libraryActions: ActionDefinition[] = [
  {
    key: "library-admit",
    label: "Admit to Historical Library",
    method: "POST",
    endpoint: "/api/admin/historical-library/admissions/{packageId}",
    idField: {
      label: "Publication Package ID",
      placeholder: "Accepted publication package UUID",
      replace: "{packageId}"
    },
    body: JSON.stringify(
      {
        actor: libraryActor,
        governanceDecisionId: "",
        requestedByService: "historical_library",
        auditRefs: [],
        reason: "Admit Telephone package into Published Memory."
      },
      null,
      2
    )
  },
  {
    key: "library-projection-metrics",
    label: "Load projection metrics",
    method: "GET",
    endpoint: "/api/admin/historical-library/projections/metrics",
    body: ""
  },
  {
    key: "library-rebuild",
    label: "Rebuild Published Memory projections",
    method: "POST",
    endpoint: "/api/admin/historical-library/projections/rebuild",
    body: "{}"
  }
];

const platformActions: ActionDefinition[] = [
  {
    key: "platform-health",
    label: "Check platform health",
    method: "GET",
    endpoint: "/api/health",
    body: ""
  },
  {
    key: "platform-timeline",
    label: "Verify Telephone timeline API",
    method: "GET",
    endpoint: "/api/timelines/{slug}",
    idField: {
      label: "Timeline Slug",
      placeholder: "telephone",
      replace: "{slug}"
    },
    body: ""
  },
  {
    key: "platform-search",
    label: "Verify Telephone search",
    method: "GET",
    endpoint: "/api/search?q=Telephone&limit=5",
    body: ""
  }
];

function parseJsonBody(value: string): unknown {
  if (!value.trim()) {
    return undefined;
  }
  return JSON.parse(value);
}

function JsonResult({ value }: { value: unknown }) {
  return <pre className="admin-json">{JSON.stringify(value, null, 2)}</pre>;
}

function ActionCard({
  action,
  fetchAdmin,
  onStatus,
  onError,
  onLoaded,
  publicRequest = false
}: {
  action: ActionDefinition;
  fetchAdmin: AdminFetcher;
  onStatus: (value: string) => void;
  onError: (value: string) => void;
  onLoaded: () => void;
  publicRequest?: boolean;
}) {
  const [body, setBody] = useState(action.body);
  const [idValue, setIdValue] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const endpoint = useMemo(() => {
    if (!action.idField) {
      return action.endpoint;
    }
    return action.endpoint.replace(action.idField.replace, encodeURIComponent(idValue.trim()));
  }, [action.endpoint, action.idField, idValue]);

  async function execute() {
    setBusy(true);
    onError("");
    onStatus(`Executing ${action.label}.`);
    try {
      if (action.idField && !idValue.trim()) {
        throw new Error(`${action.idField.label} is required.`);
      }
      const parsedBody = parseJsonBody(body);
      const init: RequestInit = {
        method: action.method,
        ...(parsedBody === undefined ? {} : { body: JSON.stringify(parsedBody) })
      };
      const nextResult = publicRequest
        ? await fetchPublic(endpoint, init)
        : await fetchAdmin<unknown>(endpoint, init);
      setResult(nextResult);
      onStatus(`${action.label} completed.`);
      onLoaded();
    } catch (error) {
      const message = error instanceof Error ? error.message : `${action.label} failed.`;
      setResult({ error: message });
      onError(message);
      onStatus(`${action.label} failed.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="glass section-card stack">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{action.method}</span>
          <h3>{action.label}</h3>
        </div>
        <button className="button" type="button" onClick={() => void execute()} disabled={busy}>
          {busy ? "Running" : "Run"}
        </button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{endpoint}</p>
      {action.idField ? (
        <label className="form-field">
          <span>{action.idField.label}</span>
          <input className="input" value={idValue} onChange={(event) => setIdValue(event.target.value)} placeholder={action.idField.placeholder} />
        </label>
      ) : null}
      {action.method !== "GET" ? (
        <label className="form-field">
          <span>JSON body</span>
          <textarea className="input" rows={12} value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
      ) : null}
      {result !== null ? <JsonResult value={result} /> : null}
    </article>
  );
}

async function fetchPublic(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof payload === "string" ? payload : JSON.stringify(payload));
  }
  return payload;
}

function ActionSection({
  title,
  copy,
  actions,
  fetchAdmin,
  statusHandlers,
  publicRequest = false
}: {
  title: string;
  copy: string;
  actions: ActionDefinition[];
  fetchAdmin: AdminFetcher;
  statusHandlers: StatusHandlers;
  publicRequest?: boolean;
}) {
  return (
    <section className="stack">
      <section className="glass section-card">
        <span className="eyebrow">Admin V2</span>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <p className="muted" style={{ marginBottom: 0 }}>{copy}</p>
      </section>
      <div className="grid two-col">
        {actions.map((action) => (
          <ActionCard
            key={action.key}
            action={action}
            fetchAdmin={fetchAdmin}
            onStatus={statusHandlers.setStatus}
            onError={statusHandlers.setError}
            onLoaded={statusHandlers.onLoaded}
            publicRequest={publicRequest}
          />
        ))}
      </div>
    </section>
  );
}

export function AdminPublicationPath({
  token,
  fetchAdmin,
  statusHandlers
}: {
  token: string;
  fetchAdmin: AdminFetcher;
  statusHandlers: StatusHandlers;
}) {
  const [stage, setStage] = useState<"factory" | "governance" | "library" | "platform">("factory");

  if (!token) {
    return (
      <section className="glass section-card">
        <span className="eyebrow">Admin V2</span>
        <p className="muted" style={{ margin: 0 }}>
          Enter an authorized operator token to run the Telephone publication path.
        </p>
      </section>
    );
  }

  return (
    <div className="stack admin-module-stack">
      <section className="glass section-card stack">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Telephone publication path</span>
            <h2>Factory {"->"} Governance {"->"} Historical Library {"->"} Platform</h2>
          </div>
          <span className="pill">existing APIs only</span>
        </div>
        <div className="admin-subnav">
          {[
            ["factory", "Factory"],
            ["governance", "Governance"],
            ["library", "Historical Library"],
            ["platform", "Platform Verification"]
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`button admin-subtab ${stage === key ? "admin-subtab-active" : ""}`}
              onClick={() => setStage(key as typeof stage)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {stage === "factory" ? (
        <ActionSection
          title="Factory"
          copy="Run and prepare Telephone candidate Production Memory for Governance handoff."
          actions={factoryActions}
          fetchAdmin={fetchAdmin}
          statusHandlers={statusHandlers}
        />
      ) : null}

      {stage === "governance" ? (
        <ActionSection
          title="Governance"
          copy="Create decisions, approve them, certify readiness, and accept the Telephone package."
          actions={governanceActions}
          fetchAdmin={fetchAdmin}
          statusHandlers={statusHandlers}
        />
      ) : null}

      {stage === "library" ? (
        <ActionSection
          title="Historical Library"
          copy="Admit the accepted package into Published Memory and verify projection operations."
          actions={libraryActions}
          fetchAdmin={fetchAdmin}
          statusHandlers={statusHandlers}
        />
      ) : null}

      {stage === "platform" ? (
        <ActionSection
          title="Platform Verification"
          copy="Verify the published Telephone read model through public Platform APIs."
          actions={platformActions}
          fetchAdmin={fetchAdmin}
          statusHandlers={statusHandlers}
          publicRequest
        />
      ) : null}
    </div>
  );
}
