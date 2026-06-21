CREATE TABLE IF NOT EXISTS historical_library_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_package_id UUID NOT NULL UNIQUE REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  admitted_by JSONB NOT NULL,
  admission_reason TEXT NOT NULL,
  source_package_snapshot JSONB NOT NULL,
  included_authority JSONB NOT NULL,
  validation_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL DEFAULT 'admitted' CHECK (lifecycle IN ('admitted', 'preserved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historical_library_published_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES historical_library_admissions(id) ON DELETE RESTRICT,
  authority_ref JSONB NOT NULL,
  snapshot JSONB NOT NULL,
  snapshot_hash TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'preserved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_library_admissions_package
  ON historical_library_admissions(publication_package_id);

CREATE INDEX IF NOT EXISTS idx_historical_library_admissions_decision
  ON historical_library_admissions(governance_decision_id);

CREATE INDEX IF NOT EXISTS idx_historical_library_published_snapshots_admission
  ON historical_library_published_snapshots(admission_id);

CREATE INDEX IF NOT EXISTS idx_historical_library_published_snapshots_authority
  ON historical_library_published_snapshots USING GIN(authority_ref);

CREATE OR REPLACE FUNCTION prevent_historical_library_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Historical Library Published Memory records are preserved and cannot be % from %. Use a governed revision workflow.', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_historical_library_admissions_delete ON historical_library_admissions;
CREATE TRIGGER prevent_historical_library_admissions_delete
BEFORE DELETE ON historical_library_admissions
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_published_snapshots_update ON historical_library_published_snapshots;
CREATE TRIGGER prevent_historical_library_published_snapshots_update
BEFORE UPDATE ON historical_library_published_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_published_snapshots_delete ON historical_library_published_snapshots;
CREATE TRIGGER prevent_historical_library_published_snapshots_delete
BEFORE DELETE ON historical_library_published_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();
