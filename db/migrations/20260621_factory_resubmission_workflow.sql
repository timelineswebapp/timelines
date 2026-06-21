ALTER TABLE factory_package_versions
  ADD COLUMN IF NOT EXISTS revision_plan_id UUID REFERENCES factory_revision_plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_feedback_package_id UUID REFERENCES governance_feedback_packages(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS resubmission_audit_record_id UUID REFERENCES factory_audit_records(id) ON DELETE RESTRICT;

ALTER TABLE factory_revision_plans
  ADD COLUMN IF NOT EXISTS superseded_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS new_package_version_id UUID UNIQUE REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS submission_audit_record_id UUID REFERENCES factory_audit_records(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS revision_completion_record_id UUID REFERENCES factory_audit_records(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_package_versions_revision_plan
  ON factory_package_versions(revision_plan_id);

CREATE INDEX IF NOT EXISTS idx_factory_package_versions_feedback
  ON factory_package_versions(source_feedback_package_id);

CREATE INDEX IF NOT EXISTS idx_factory_revision_plans_new_version
  ON factory_revision_plans(new_package_version_id);
