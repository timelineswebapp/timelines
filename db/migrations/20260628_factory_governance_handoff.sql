CREATE TABLE IF NOT EXISTS factory_governance_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID REFERENCES factory_pipeline_runs(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'submitted_to_governance', 'cancelled', 'preserved')),
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  submission_reason TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_package_draft_id)
);

CREATE TABLE IF NOT EXISTS factory_submission_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id UUID NOT NULL REFERENCES factory_governance_handoffs(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  package_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  pipeline_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_submission_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id UUID NOT NULL REFERENCES factory_governance_handoffs(id) ON DELETE RESTRICT,
  pipeline_run_id UUID REFERENCES factory_pipeline_runs(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  worker_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  governance_decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_governance_handoffs_status ON factory_governance_handoffs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_governance_handoffs_pipeline ON factory_governance_handoffs(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_factory_submission_audit_handoff ON factory_submission_audit_records(handoff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_submission_lineage_handoff ON factory_submission_lineage(handoff_id);

DROP TRIGGER IF EXISTS trigger_factory_governance_handoffs_updated_at ON factory_governance_handoffs;
CREATE TRIGGER trigger_factory_governance_handoffs_updated_at
BEFORE UPDATE ON factory_governance_handoffs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS prevent_factory_governance_handoffs_delete ON factory_governance_handoffs;
CREATE TRIGGER prevent_factory_governance_handoffs_delete
BEFORE DELETE ON factory_governance_handoffs
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_submission_audit_records_delete ON factory_submission_audit_records;
CREATE TRIGGER prevent_factory_submission_audit_records_delete
BEFORE DELETE ON factory_submission_audit_records
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_submission_lineage_delete ON factory_submission_lineage;
CREATE TRIGGER prevent_factory_submission_lineage_delete
BEFORE DELETE ON factory_submission_lineage
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();
