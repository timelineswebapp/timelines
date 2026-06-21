ALTER TABLE governance_publication_packages
  ADD COLUMN IF NOT EXISTS factory_package_version_id UUID UNIQUE REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS factory_package_draft_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS factory_lineage_root_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS submitted_by JSONB,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submission_audit_record_id UUID;

CREATE TABLE IF NOT EXISTS factory_governance_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_package_version_id UUID NOT NULL UNIQUE REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_lineage_root_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  governance_publication_package_id UUID NOT NULL UNIQUE REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  submission_actor JSONB NOT NULL,
  submission_reason TEXT NOT NULL,
  submission_audit_record_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_publication_packages_factory_version
  ON governance_publication_packages(factory_package_version_id);

CREATE INDEX IF NOT EXISTS idx_factory_governance_submissions_lineage
  ON factory_governance_submissions(factory_lineage_root_id, created_at DESC);

DROP TRIGGER IF EXISTS prevent_factory_governance_submissions_delete ON factory_governance_submissions;
CREATE TRIGGER prevent_factory_governance_submissions_delete
BEFORE DELETE ON factory_governance_submissions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();
