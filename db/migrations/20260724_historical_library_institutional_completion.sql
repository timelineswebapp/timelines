CREATE UNIQUE INDEX IF NOT EXISTS uq_historical_library_canonical_authority
  ON historical_library_published_snapshots (
    (authority_ref->>'authorityType'),
    (authority_ref->>'authorityId')
  );

DROP TRIGGER IF EXISTS prevent_historical_library_admissions_update ON historical_library_admissions;
CREATE TRIGGER prevent_historical_library_admissions_update
BEFORE UPDATE ON historical_library_admissions
FOR EACH ROW EXECUTE FUNCTION prevent_historical_library_mutation();

CREATE TRIGGER prevent_historical_library_revisions_update
BEFORE UPDATE ON historical_library_published_revisions
FOR EACH ROW EXECUTE FUNCTION prevent_historical_library_mutation();
CREATE TRIGGER prevent_historical_library_retirements_update
BEFORE UPDATE ON historical_library_retirements
FOR EACH ROW EXECUTE FUNCTION prevent_historical_library_mutation();
CREATE TRIGGER prevent_historical_library_merges_update
BEFORE UPDATE ON historical_library_merges
FOR EACH ROW EXECUTE FUNCTION prevent_historical_library_mutation();
CREATE TRIGGER prevent_historical_library_preservations_update
BEFORE UPDATE ON historical_library_preservations
FOR EACH ROW EXECUTE FUNCTION prevent_historical_library_mutation();
CREATE TRIGGER prevent_historical_library_feedback_links_update
BEFORE UPDATE ON historical_library_feedback_links
FOR EACH ROW EXECUTE FUNCTION prevent_historical_library_mutation();

CREATE TABLE historical_library_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_snapshot_id UUID NOT NULL UNIQUE REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  withdrawal_reason TEXT NOT NULL CHECK (length(trim(withdrawal_reason)) > 0),
  continuity_path JSONB NOT NULL,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE historical_library_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_published_record_id UUID NOT NULL UNIQUE REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  split_reason TEXT NOT NULL CHECK (length(trim(split_reason)) > 0),
  provenance JSONB NOT NULL,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE historical_library_split_children (
  split_id UUID NOT NULL REFERENCES historical_library_splits(id) ON DELETE RESTRICT,
  child_published_record_id UUID NOT NULL UNIQUE REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  redirect_metadata JSONB NOT NULL,
  PRIMARY KEY (split_id, child_published_record_id),
  UNIQUE (split_id, sequence)
);

CREATE TABLE historical_library_supersessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  previous_published_record_id UUID NOT NULL UNIQUE REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  new_published_record_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  supersession_reason TEXT NOT NULL CHECK (length(trim(supersession_reason)) > 0),
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (previous_published_record_id <> new_published_record_id)
);

CREATE TABLE historical_library_continuity_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'revision', 'merge', 'split', 'supersession', 'retirement', 'withdrawal', 'preservation'
  )),
  operation_id UUID NOT NULL,
  source_published_record_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  target_published_record_id UUID REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  relationship TEXT NOT NULL CHECK (relationship IN (
    'revised_as', 'merged_into', 'split_into', 'superseded_by', 'retired', 'withdrawn', 'preserved'
  )),
  lineage JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (relationship IN ('retired', 'withdrawn', 'preserved') AND target_published_record_id IS NULL)
    OR
    (relationship NOT IN ('retired', 'withdrawn', 'preserved') AND target_published_record_id IS NOT NULL)
  ),
  UNIQUE (operation_type, operation_id, source_published_record_id, target_published_record_id)
);

CREATE TABLE historical_library_lifecycle_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'admission', 'revision', 'merge', 'split', 'supersession', 'retirement', 'withdrawal', 'preservation'
  )),
  operation_id UUID NOT NULL,
  authority_ids UUID[] NOT NULL CHECK (cardinality(authority_ids) > 0),
  previous_authority_id UUID REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  new_authority_ids UUID[] NOT NULL DEFAULT '{}',
  governance_decision_id UUID REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  actor JSONB NOT NULL,
  reference_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operation_type, operation_id)
);

CREATE INDEX idx_historical_library_continuity_source
  ON historical_library_continuity_edges(source_published_record_id, created_at);
CREATE INDEX idx_historical_library_continuity_target
  ON historical_library_continuity_edges(target_published_record_id, created_at)
  WHERE target_published_record_id IS NOT NULL;
CREATE INDEX idx_historical_library_lifecycle_audit_authority
  ON historical_library_lifecycle_audit USING GIN(authority_ids);

CREATE VIEW historical_library_active_canonical_authority AS
SELECT snapshot.*
FROM historical_library_published_snapshots snapshot
WHERE NOT EXISTS (
  SELECT 1 FROM historical_library_retirements item WHERE item.published_snapshot_id=snapshot.id
)
AND NOT EXISTS (
  SELECT 1 FROM historical_library_withdrawals item WHERE item.published_snapshot_id=snapshot.id
)
AND NOT EXISTS (
  SELECT 1 FROM historical_library_merges item WHERE item.source_published_record_id=snapshot.id
)
AND NOT EXISTS (
  SELECT 1 FROM historical_library_splits item WHERE item.source_published_record_id=snapshot.id
)
AND NOT EXISTS (
  SELECT 1 FROM historical_library_supersessions item WHERE item.previous_published_record_id=snapshot.id
);

CREATE OR REPLACE FUNCTION record_existing_historical_library_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
  operation_type_value TEXT;
  relationship_value TEXT;
  source_id UUID;
  target_id UUID;
  reason_value TEXT;
  actor_value JSONB;
  decision_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'historical_library_published_revisions' THEN
    operation_type_value := 'revision'; relationship_value := 'revised_as';
    source_id := NEW.published_snapshot_id; target_id := NEW.published_snapshot_id;
    reason_value := NEW.amendment_summary; actor_value := NEW.created_by; decision_id := NEW.governance_decision_id;
  ELSIF TG_TABLE_NAME = 'historical_library_retirements' THEN
    operation_type_value := 'retirement'; relationship_value := 'retired';
    source_id := NEW.published_snapshot_id; target_id := NULL;
    reason_value := NEW.retirement_reason; actor_value := NEW.created_by; decision_id := NEW.governance_decision_id;
  ELSIF TG_TABLE_NAME = 'historical_library_merges' THEN
    operation_type_value := 'merge'; relationship_value := 'merged_into';
    source_id := NEW.source_published_record_id; target_id := NEW.target_published_record_id;
    reason_value := NEW.merge_reason; actor_value := NEW.created_by; decision_id := NEW.governance_decision_id;
  ELSE
    operation_type_value := 'preservation'; relationship_value := 'preserved';
    source_id := NEW.published_snapshot_id; target_id := NULL;
    reason_value := NEW.preservation_reason; actor_value := NEW.created_by; decision_id := NEW.governance_decision_id;
  END IF;
  INSERT INTO historical_library_continuity_edges (
    operation_type, operation_id, source_published_record_id, target_published_record_id, relationship, lineage
  ) VALUES (operation_type_value, NEW.id, source_id, target_id, relationship_value, '{}'::jsonb);
  INSERT INTO historical_library_lifecycle_audit (
    operation_type, operation_id, authority_ids, previous_authority_id, new_authority_ids,
    governance_decision_id, reason, actor, reference_data
  ) VALUES (
    operation_type_value, NEW.id, array_remove(ARRAY[source_id, target_id], NULL), source_id,
    CASE WHEN target_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[target_id] END,
    decision_id, reason_value, actor_value, '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER record_historical_library_revision_lifecycle
AFTER INSERT ON historical_library_published_revisions
FOR EACH ROW EXECUTE FUNCTION record_existing_historical_library_lifecycle();
CREATE TRIGGER record_historical_library_retirement_lifecycle
AFTER INSERT ON historical_library_retirements
FOR EACH ROW EXECUTE FUNCTION record_existing_historical_library_lifecycle();
CREATE TRIGGER record_historical_library_merge_lifecycle
AFTER INSERT ON historical_library_merges
FOR EACH ROW EXECUTE FUNCTION record_existing_historical_library_lifecycle();
CREATE TRIGGER record_historical_library_preservation_lifecycle
AFTER INSERT ON historical_library_preservations
FOR EACH ROW EXECUTE FUNCTION record_existing_historical_library_lifecycle();

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'historical_library_withdrawals',
    'historical_library_splits',
    'historical_library_split_children',
    'historical_library_supersessions',
    'historical_library_continuity_edges',
    'historical_library_lifecycle_audit'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER prevent_%I_mutation BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_historical_library_mutation()',
      table_name, table_name
    );
  END LOOP;
END $$;
