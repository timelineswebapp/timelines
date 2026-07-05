CREATE TABLE IF NOT EXISTS factory_editorial_evidence_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL CHECK (length(btrim(topic)) BETWEEN 1 AND 300),
  algorithm_version TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL CHECK (input_fingerprint ~ '^[a-f0-9]{64}$'),
  payload JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic, algorithm_version, input_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_factory_editorial_evidence_sets_topic_created
  ON factory_editorial_evidence_sets(topic, created_at DESC);

CREATE TABLE IF NOT EXISTS factory_editorial_evidence_set_inputs (
  editorial_evidence_set_id UUID NOT NULL REFERENCES factory_editorial_evidence_sets(id) ON DELETE RESTRICT,
  evidence_record_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE RESTRICT,
  validation_record_id UUID NOT NULL REFERENCES evidence_validation_records(id) ON DELETE RESTRICT,
  rank INTEGER NOT NULL CHECK (rank > 0),
  score JSONB NOT NULL,
  duplicate_of_evidence_record_id UUID REFERENCES evidence_records(id) ON DELETE RESTRICT,
  PRIMARY KEY (editorial_evidence_set_id, evidence_record_id),
  UNIQUE (editorial_evidence_set_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_factory_editorial_evidence_inputs_evidence
  ON factory_editorial_evidence_set_inputs(evidence_record_id);

CREATE OR REPLACE FUNCTION prevent_factory_editorial_evidence_set_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Factory Editorial Evidence Sets are immutable Production Memory.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_factory_editorial_evidence_sets_update ON factory_editorial_evidence_sets;
CREATE TRIGGER prevent_factory_editorial_evidence_sets_update
BEFORE UPDATE OR DELETE ON factory_editorial_evidence_sets
FOR EACH ROW EXECUTE FUNCTION prevent_factory_editorial_evidence_set_mutation();

DROP TRIGGER IF EXISTS prevent_factory_editorial_evidence_set_inputs_update ON factory_editorial_evidence_set_inputs;
CREATE TRIGGER prevent_factory_editorial_evidence_set_inputs_update
BEFORE UPDATE OR DELETE ON factory_editorial_evidence_set_inputs
FOR EACH ROW EXECUTE FUNCTION prevent_factory_editorial_evidence_set_mutation();
