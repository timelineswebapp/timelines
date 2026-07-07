CREATE TABLE search_certification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind = 'search_end_to_end'),
  scope TEXT NOT NULL CHECK (scope = 'end-to-end'),
  framework_version TEXT NOT NULL CHECK (framework_version = 'search-certification-v1'),
  certification_version TEXT NOT NULL CHECK (certification_version = 'search-end-to-end-v1'),
  corpus_version TEXT NOT NULL,
  corpus_fingerprint TEXT NOT NULL CHECK (length(corpus_fingerprint) = 64),
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  final_verdict TEXT NOT NULL CHECK (final_verdict IN ('CERTIFIED', 'NOT CERTIFIED')),
  boundary JSONB NOT NULL,
  subjects TEXT[] NOT NULL CHECK (cardinality(subjects) > 0),
  search_statistics JSONB NOT NULL,
  failure_statistics JSONB NOT NULL,
  determinism_results JSONB NOT NULL,
  replay_results JSONB NOT NULL,
  recovery_results JSONB NOT NULL,
  regression_results JSONB NOT NULL,
  summary JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE search_certification_stage_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_run_id UUID NOT NULL REFERENCES search_certification_runs(id) ON DELETE RESTRICT,
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (certification_run_id, stage)
);

CREATE TABLE search_certification_case_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_run_id UUID NOT NULL REFERENCES search_certification_runs(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  expected_fingerprint TEXT NOT NULL CHECK (length(expected_fingerprint) = 64),
  actual_fingerprint TEXT NOT NULL CHECK (length(actual_fingerprint) = 64),
  exact_input JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (certification_run_id, case_id)
);

CREATE TABLE search_certification_search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_result_id UUID NOT NULL REFERENCES search_certification_case_results(id) ON DELETE RESTRICT,
  area TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  projection_verified BOOLEAN NOT NULL,
  lineage_verified BOOLEAN NOT NULL,
  audit_verified BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_result_id, area)
);

CREATE TABLE search_certification_failure_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_result_id UUID NOT NULL REFERENCES search_certification_case_results(id) ON DELETE RESTRICT,
  failure_key TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  expected TEXT NOT NULL CHECK (expected = 'fail_closed'),
  actual TEXT NOT NULL CHECK (actual IN ('fail_closed', 'not_verified')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_result_id, failure_key)
);

CREATE TABLE search_certification_invariant_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_result_id UUID NOT NULL REFERENCES search_certification_case_results(id) ON DELETE RESTRICT,
  invariant_key TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  expected JSONB NOT NULL,
  actual JSONB NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_result_id, invariant_key)
);

CREATE INDEX idx_search_certification_runs_created_at ON search_certification_runs(created_at DESC);
CREATE INDEX idx_search_certification_case_results_run ON search_certification_case_results(certification_run_id);

CREATE OR REPLACE FUNCTION prevent_search_certification_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Search Certification reports are immutable institutional evidence.';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE table_name TEXT;
DECLARE trigger_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'search_certification_runs',
    'search_certification_stage_results',
    'search_certification_case_results',
    'search_certification_search_results',
    'search_certification_failure_results',
    'search_certification_invariant_results'
  ] LOOP
    trigger_name := 'prevent_sr_cert_' || replace(table_name, 'search_certification_', '') || '_mut';
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_search_certification_mutation()',
      trigger_name, table_name
    );
  END LOOP;
END $$;
