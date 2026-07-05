CREATE TABLE factory_editorial_certification_runs (
  id UUID PRIMARY KEY,
  epic TEXT NOT NULL CHECK (epic = 'EI-002'),
  framework_version TEXT NOT NULL CHECK (length(btrim(framework_version)) BETWEEN 1 AND 100),
  corpus_version TEXT NOT NULL CHECK (length(btrim(corpus_version)) BETWEEN 1 AND 100),
  corpus_fingerprint TEXT NOT NULL CHECK (corpus_fingerprint ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  authority_decision BOOLEAN NOT NULL CHECK (authority_decision = FALSE),
  publication_readiness_decision BOOLEAN NOT NULL CHECK (publication_readiness_decision = FALSE),
  summary JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE factory_editorial_certification_case_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_run_id UUID NOT NULL REFERENCES factory_editorial_certification_runs(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL CHECK (length(btrim(case_id)) BETWEEN 1 AND 200),
  topic TEXT NOT NULL CHECK (length(btrim(topic)) BETWEEN 1 AND 300),
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  compiler_version TEXT NOT NULL,
  selection_algorithm_version TEXT NOT NULL,
  expected_fingerprint TEXT NOT NULL CHECK (expected_fingerprint ~ '^[a-f0-9]{64}$'),
  actual_fingerprint TEXT NOT NULL CHECK (actual_fingerprint = '' OR actual_fingerprint ~ '^[a-f0-9]{64}$'),
  exact_input JSONB NOT NULL,
  actual_output JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (certification_run_id, case_id)
);

CREATE TABLE factory_editorial_certification_invariant_results (
  case_result_id UUID NOT NULL REFERENCES factory_editorial_certification_case_results(id) ON DELETE RESTRICT,
  invariant_key TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  expected JSONB NOT NULL,
  actual JSONB NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_result_id, invariant_key)
);

CREATE INDEX idx_factory_editorial_certification_runs_version
  ON factory_editorial_certification_runs(epic, framework_version, corpus_version, created_at DESC);

CREATE INDEX idx_factory_editorial_certification_runs_status
  ON factory_editorial_certification_runs(status, created_at DESC);

CREATE INDEX idx_factory_editorial_certification_cases_topic
  ON factory_editorial_certification_case_results(topic, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_editorial_certification_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Editorial Certification evidence is immutable Factory Production Memory.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_factory_editorial_certification_runs_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_certification_runs
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_certification_mutation();

CREATE TRIGGER prevent_factory_editorial_certification_cases_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_certification_case_results
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_certification_mutation();

CREATE TRIGGER prevent_factory_editorial_certification_invariants_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_certification_invariant_results
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_certification_mutation();

