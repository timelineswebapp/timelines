CREATE TABLE IF NOT EXISTS historical_library_published_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  previous_snapshot JSONB NOT NULL,
  revised_snapshot JSONB NOT NULL,
  revised_snapshot_hash TEXT NOT NULL,
  amendment_summary TEXT NOT NULL,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historical_library_retirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  retirement_reason TEXT NOT NULL,
  continuity_path JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (published_snapshot_id)
);

CREATE TABLE IF NOT EXISTS historical_library_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_published_record_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  target_published_record_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  merge_reason TEXT NOT NULL,
  continuity_path JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_published_record_id IS DISTINCT FROM target_published_record_id),
  UNIQUE (source_published_record_id)
);

CREATE TABLE IF NOT EXISTS historical_library_preservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  preservation_reason TEXT NOT NULL,
  preservation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historical_library_feedback_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_action_type TEXT NOT NULL CHECK (
    lifecycle_action_type IN ('revision', 'retirement', 'merge', 'preservation')
  ),
  lifecycle_action_id UUID NOT NULL,
  feedback_package_id UUID NOT NULL UNIQUE REFERENCES governance_feedback_packages(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  source_published_record_id UUID REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  target_published_record_id UUID REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_library_revisions_snapshot
  ON historical_library_published_revisions(published_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_historical_library_retirements_snapshot
  ON historical_library_retirements(published_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_historical_library_merges_source
  ON historical_library_merges(source_published_record_id);

CREATE INDEX IF NOT EXISTS idx_historical_library_merges_target
  ON historical_library_merges(target_published_record_id);

CREATE INDEX IF NOT EXISTS idx_historical_library_preservations_snapshot
  ON historical_library_preservations(published_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_historical_library_feedback_links_action
  ON historical_library_feedback_links(lifecycle_action_type, lifecycle_action_id);

DROP TRIGGER IF EXISTS prevent_historical_library_revisions_delete ON historical_library_published_revisions;
CREATE TRIGGER prevent_historical_library_revisions_delete
BEFORE DELETE ON historical_library_published_revisions
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_retirements_delete ON historical_library_retirements;
CREATE TRIGGER prevent_historical_library_retirements_delete
BEFORE DELETE ON historical_library_retirements
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_merges_delete ON historical_library_merges;
CREATE TRIGGER prevent_historical_library_merges_delete
BEFORE DELETE ON historical_library_merges
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_preservations_delete ON historical_library_preservations;
CREATE TRIGGER prevent_historical_library_preservations_delete
BEFORE DELETE ON historical_library_preservations
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_feedback_links_delete ON historical_library_feedback_links;
CREATE TRIGGER prevent_historical_library_feedback_links_delete
BEFORE DELETE ON historical_library_feedback_links
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();
