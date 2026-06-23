CREATE TABLE IF NOT EXISTS evidence_validation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_record_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  checks JSONB NOT NULL,
  provenance JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_validation_records_evidence
  ON evidence_validation_records(evidence_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_validation_records_status
  ON evidence_validation_records(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_validation_records_provenance
  ON evidence_validation_records USING GIN(provenance);

CREATE OR REPLACE FUNCTION prevent_evidence_validation_records_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Evidence validation records are immutable validation history and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_evidence_validation_records_update ON evidence_validation_records;
CREATE TRIGGER prevent_evidence_validation_records_update
BEFORE UPDATE ON evidence_validation_records
FOR EACH ROW
EXECUTE FUNCTION prevent_evidence_validation_records_mutation();

DROP TRIGGER IF EXISTS prevent_evidence_validation_records_delete ON evidence_validation_records;
CREATE TRIGGER prevent_evidence_validation_records_delete
BEFORE DELETE ON evidence_validation_records
FOR EACH ROW
EXECUTE FUNCTION prevent_evidence_validation_records_mutation();
