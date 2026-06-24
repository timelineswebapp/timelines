CREATE TABLE IF NOT EXISTS factory_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL CHECK (
    object_type IN (
      'candidate_historical_object',
      'candidate_milestone',
      'candidate_participation',
      'candidate_relationship',
      'candidate_source',
      'candidate_context_record'
    )
  ),
  title TEXT NOT NULL,
  payload JSONB NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle IN (
      'draft',
      'researching',
      'validated',
      'validation_failed',
      'package_candidate',
      'packaged',
      'submitted_to_governance',
      'returned_for_revision',
      'superseded',
      'preserved'
    )
  ),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_object_id UUID REFERENCES factory_objects(id) ON DELETE RESTRICT,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN ('validation', 'evidence', 'enrichment', 'generation', 'audit')
  ),
  title TEXT NOT NULL,
  payload JSONB NOT NULL,
  authority_safe BOOLEAN NOT NULL DEFAULT FALSE,
  model_provider TEXT,
  model_name TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_package_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  package_type TEXT NOT NULL CHECK (
    package_type IN (
      'historical_object_publication',
      'participation_publication',
      'timeline_context_publication',
      'mixed_authority_publication'
    )
  ),
  factory_object_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  validated_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle IN (
      'draft',
      'validating',
      'ready_for_governance',
      'submitted_to_governance',
      'returned_for_revision',
      'revised',
      'superseded',
      'preserved'
    )
  ),
  lineage_root_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  supersedes_package_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id IS DISTINCT FROM lineage_root_id),
  CHECK (id IS DISTINCT FROM supersedes_package_id)
);

CREATE TABLE IF NOT EXISTS factory_package_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  lineage_root_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  supersedes_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  package_snapshot JSONB NOT NULL,
  snapshot_hash TEXT NOT NULL,
  validated_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle IN ('draft', 'submitted_to_governance', 'returned_for_revision', 'superseded', 'preserved')
  ),
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  feedback_package_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  UNIQUE (lineage_root_id, version),
  CHECK (id IS DISTINCT FROM supersedes_version_id)
);

CREATE TABLE IF NOT EXISTS factory_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_ref JSONB NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_objects_type_lifecycle ON factory_objects(object_type, lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_artifacts_object_type ON factory_artifacts(factory_object_id, artifact_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_package_drafts_lifecycle ON factory_package_drafts(lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_package_drafts_lineage ON factory_package_drafts(lineage_root_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_package_versions_draft ON factory_package_versions(draft_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_factory_package_versions_lineage ON factory_package_versions(lineage_root_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_factory_audit_records_target ON factory_audit_records USING GIN(target_ref);

DROP TRIGGER IF EXISTS trigger_factory_objects_updated_at ON factory_objects;
CREATE TRIGGER trigger_factory_objects_updated_at
BEFORE UPDATE ON factory_objects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_package_drafts_updated_at ON factory_package_drafts;
CREATE TRIGGER trigger_factory_package_drafts_updated_at
BEFORE UPDATE ON factory_package_drafts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION prevent_factory_history_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Factory Production Memory records are preserved and cannot be deleted from %. Use lifecycle transitions.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_submitted_factory_package_version_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.lifecycle = 'submitted_to_governance' THEN
    RAISE EXCEPTION 'Submitted Factory package versions are immutable. Create a new version for revisions.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_factory_objects_delete ON factory_objects;
CREATE TRIGGER prevent_factory_objects_delete
BEFORE DELETE ON factory_objects
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_artifacts_delete ON factory_artifacts;
CREATE TRIGGER prevent_factory_artifacts_delete
BEFORE DELETE ON factory_artifacts
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_package_drafts_delete ON factory_package_drafts;
CREATE TRIGGER prevent_factory_package_drafts_delete
BEFORE DELETE ON factory_package_drafts
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_package_versions_delete ON factory_package_versions;
CREATE TRIGGER prevent_factory_package_versions_delete
BEFORE DELETE ON factory_package_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_package_versions_submitted_update ON factory_package_versions;
CREATE TRIGGER prevent_factory_package_versions_submitted_update
BEFORE UPDATE ON factory_package_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_submitted_factory_package_version_update();

DROP TRIGGER IF EXISTS prevent_factory_audit_records_delete ON factory_audit_records;
CREATE TRIGGER prevent_factory_audit_records_delete
BEFORE DELETE ON factory_audit_records
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();
