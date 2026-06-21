CREATE TABLE IF NOT EXISTS governance_decisions (
  id UUID PRIMARY KEY,
  decision_type TEXT NOT NULL CHECK (
    decision_type IN (
      'ADMIT_HISTORICAL_OBJECT',
      'REVISE_HISTORICAL_OBJECT',
      'MERGE_HISTORICAL_OBJECT',
      'RETIRE_HISTORICAL_OBJECT',
      'PRESERVE_HISTORICAL_OBJECT',
      'ADMIT_PARTICIPATION',
      'REVISE_PARTICIPATION',
      'CHANGE_PARTICIPATION_PRIORITY',
      'RETIRE_PARTICIPATION',
      'CERTIFY_PUBLICATION_READINESS',
      'ACCEPT_PUBLICATION_PACKAGE',
      'REJECT_PUBLICATION_PACKAGE',
      'RETURN_PUBLICATION_PACKAGE',
      'CREATE_FEEDBACK_PACKAGE',
      'CLOSE_FEEDBACK_PACKAGE',
      'OPEN_DISPUTE',
      'RESOLVE_DISPUTE',
      'ESCALATE_AUTHORITY_REVIEW'
    )
  ),
  target_authority JSONB NOT NULL,
  actor JSONB NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale JSONB NOT NULL,
  approval_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  escalation_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'rejected', 'returned_for_revision', 'escalated', 'superseded', 'no_action')),
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN ('draft', 'submitted', 'under_review', 'approval_pending', 'approved', 'rejected', 'returned_for_revision', 'escalated', 'superseded', 'preserved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS governance_approvals (
  id UUID PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  request JSONB NOT NULL,
  steps JSONB NOT NULL,
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN ('requested', 'pending', 'partially_approved', 'approved', 'rejected', 'returned_for_revision', 'escalated', 'expired', 'preserved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS governance_queues (
  id UUID PRIMARY KEY,
  queue_type TEXT NOT NULL CHECK (
    queue_type IN (
      'object_intake',
      'object_validation',
      'participation_intake',
      'participation_priority_review',
      'publication_readiness',
      'library_review',
      'feedback_return',
      'dispute_triage',
      'escalation_review',
      'audit_review'
    )
  ),
  owner_service TEXT NOT NULL CHECK (owner_service IN ('factory', 'governance', 'historical_library', 'registry', 'platform')),
  owner_role TEXT NOT NULL CHECK (
    owner_role IN ('factory_editor', 'governance_reviewer', 'senior_governance_reviewer', 'library_editor', 'registry_operator', 'auditor')
  ),
  target_authority JSONB NOT NULL,
  allowed_actions JSONB NOT NULL,
  decision_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('entered', 'in_review', 'blocked', 'exited', 'preserved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_publication_packages (
  id UUID PRIMARY KEY,
  scope JSONB NOT NULL,
  included_authority JSONB NOT NULL,
  validation_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_summary JSONB NOT NULL,
  readiness_certification JSONB,
  acceptance_outcome TEXT CHECK (acceptance_outcome IN ('accepted', 'rejected', 'returned_for_revision', 'accepted_with_notes')),
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN (
      'factory_draft',
      'factory_validating',
      'factory_ready',
      'governance_review',
      'readiness_certified',
      'library_review',
      'accepted',
      'rejected',
      'returned_for_revision',
      'published',
      'preserved'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_feedback_packages (
  id UUID PRIMARY KEY,
  origin JSONB NOT NULL,
  affected_authority JSONB NOT NULL,
  correction_class TEXT NOT NULL CHECK (
    correction_class IN ('authority_error', 'missing_context', 'participation_error', 'priority_error', 'source_gap', 'publication_quality_issue', 'audit_gap')
  ),
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_response TEXT NOT NULL CHECK (
    required_response IN ('factory_acknowledgement', 'factory_revision', 'governance_review', 'new_publication_package', 'no_action_required')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'blocking')),
  closure_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN ('created', 'delivered_to_factory', 'acknowledged', 'factory_reviewing', 'action_required', 'informational', 'resolved', 'closed', 'preserved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS governance_disputes (
  id UUID PRIMARY KEY,
  target_authority JSONB NOT NULL,
  dispute_class TEXT NOT NULL CHECK (
    dispute_class IN (
      'identity_conflict',
      'chronology_conflict',
      'participation_conflict',
      'priority_conflict',
      'source_conflict',
      'publication_conflict',
      'governance_process_conflict'
    )
  ),
  evidence_bundle JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'material', 'high', 'blocking')),
  resolution_path TEXT NOT NULL CHECK (resolution_path IN ('standard_review', 'senior_review', 'library_review', 'factory_revision', 'audit_review')),
  outcome TEXT CHECK (outcome IN ('upheld', 'rejected', 'amended', 'merged', 'retired', 'returned_for_revision')),
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN ('raised', 'triaged', 'evidence_gathering', 'review_pending', 'escalated', 'resolved_upheld', 'resolved_rejected', 'resolved_amended', 'closed', 'preserved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS governance_audit_records (
  id UUID PRIMARY KEY,
  authority_ref JSONB NOT NULL,
  decision_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  package_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  dispute_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_state TEXT NOT NULL,
  reconstruction JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_decisions_target ON governance_decisions USING GIN(target_authority);
CREATE INDEX IF NOT EXISTS idx_governance_decisions_lifecycle ON governance_decisions(lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_decision ON governance_approvals(decision_id, lifecycle);
CREATE INDEX IF NOT EXISTS idx_governance_queues_owner ON governance_queues(owner_service, queue_type, lifecycle);
CREATE INDEX IF NOT EXISTS idx_governance_publication_packages_lifecycle ON governance_publication_packages(lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_feedback_packages_lifecycle ON governance_feedback_packages(lifecycle, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_disputes_lifecycle ON governance_disputes(lifecycle, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_audit_records_authority ON governance_audit_records USING GIN(authority_ref);

DROP TRIGGER IF EXISTS trigger_governance_queues_updated_at ON governance_queues;
CREATE TRIGGER trigger_governance_queues_updated_at
BEFORE UPDATE ON governance_queues
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_governance_publication_packages_updated_at ON governance_publication_packages;
CREATE TRIGGER trigger_governance_publication_packages_updated_at
BEFORE UPDATE ON governance_publication_packages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS prevent_governance_decisions_delete ON governance_decisions;
CREATE TRIGGER prevent_governance_decisions_delete
BEFORE DELETE ON governance_decisions
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_approvals_delete ON governance_approvals;
CREATE TRIGGER prevent_governance_approvals_delete
BEFORE DELETE ON governance_approvals
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_queues_delete ON governance_queues;
CREATE TRIGGER prevent_governance_queues_delete
BEFORE DELETE ON governance_queues
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_publication_packages_delete ON governance_publication_packages;
CREATE TRIGGER prevent_governance_publication_packages_delete
BEFORE DELETE ON governance_publication_packages
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_feedback_packages_delete ON governance_feedback_packages;
CREATE TRIGGER prevent_governance_feedback_packages_delete
BEFORE DELETE ON governance_feedback_packages
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_disputes_delete ON governance_disputes;
CREATE TRIGGER prevent_governance_disputes_delete
BEFORE DELETE ON governance_disputes
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_audit_records_delete ON governance_audit_records;
CREATE TRIGGER prevent_governance_audit_records_delete
BEFORE DELETE ON governance_audit_records
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();
