CREATE TABLE IF NOT EXISTS factory_feedback_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_package_id UUID NOT NULL UNIQUE REFERENCES governance_feedback_packages(id) ON DELETE RESTRICT,
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  factory_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_lineage_root_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  affected_factory_object_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  classification TEXT NOT NULL CHECK (
    classification IN ('authority_error', 'missing_context', 'participation_error', 'priority_error', 'source_gap', 'publication_quality_issue', 'audit_gap')
  ),
  required_response TEXT NOT NULL CHECK (
    required_response IN ('factory_acknowledgement', 'factory_revision', 'governance_review', 'new_publication_package', 'no_action_required')
  ),
  lifecycle TEXT NOT NULL DEFAULT 'received' CHECK (
    lifecycle IN (
      'received',
      'acknowledged',
      'triaged',
      'revision_required',
      'revision_in_progress',
      'resubmission_prepared',
      'resolved',
      'closed',
      'preserved'
    )
  ),
  revision_plan_id UUID,
  resolution_record_id UUID,
  audit_record_id UUID NOT NULL REFERENCES factory_audit_records(id) ON DELETE RESTRICT,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_revision_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_consumption_id UUID NOT NULL REFERENCES factory_feedback_consumptions(id) ON DELETE RESTRICT,
  feedback_package_id UUID NOT NULL REFERENCES governance_feedback_packages(id) ON DELETE RESTRICT,
  factory_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_lineage_root_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  affected_factory_object_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  plan_summary TEXT NOT NULL,
  planned_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle IN ('draft', 'approved', 'in_progress', 'resubmission_prepared', 'resolved', 'closed', 'preserved')
  ),
  resubmission_package_draft_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  audit_record_id UUID NOT NULL REFERENCES factory_audit_records(id) ON DELETE RESTRICT,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_feedback_consumptions_feedback
  ON factory_feedback_consumptions(feedback_package_id);

CREATE INDEX IF NOT EXISTS idx_factory_feedback_consumptions_lineage
  ON factory_feedback_consumptions(factory_lineage_root_id, lifecycle, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_factory_revision_plans_consumption
  ON factory_revision_plans(feedback_consumption_id);

CREATE INDEX IF NOT EXISTS idx_factory_revision_plans_lineage
  ON factory_revision_plans(factory_lineage_root_id, lifecycle, created_at DESC);

DROP TRIGGER IF EXISTS trigger_factory_feedback_consumptions_updated_at ON factory_feedback_consumptions;
CREATE TRIGGER trigger_factory_feedback_consumptions_updated_at
BEFORE UPDATE ON factory_feedback_consumptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_revision_plans_updated_at ON factory_revision_plans;
CREATE TRIGGER trigger_factory_revision_plans_updated_at
BEFORE UPDATE ON factory_revision_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS prevent_factory_feedback_consumptions_delete ON factory_feedback_consumptions;
CREATE TRIGGER prevent_factory_feedback_consumptions_delete
BEFORE DELETE ON factory_feedback_consumptions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_revision_plans_delete ON factory_revision_plans;
CREATE TRIGGER prevent_factory_revision_plans_delete
BEFORE DELETE ON factory_revision_plans
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();
