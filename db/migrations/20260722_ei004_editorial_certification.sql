ALTER TABLE factory_editorial_certification_runs
  DROP CONSTRAINT IF EXISTS factory_editorial_certification_runs_epic_check;
ALTER TABLE factory_editorial_certification_runs
  ADD CONSTRAINT factory_editorial_certification_runs_epic_check
  CHECK (epic IN ('EI-002', 'EI-003', 'EI-004'));

ALTER TABLE factory_editorial_certification_case_results
  ADD COLUMN writer_version TEXT,
  ADD COLUMN generation_algorithm_version TEXT,
  ADD COLUMN execution_key TEXT,
  ADD COLUMN narrative_id UUID,
  ADD COLUMN revision_identity JSONB,
  ADD COLUMN prompt_fingerprints TEXT[],
  ADD COLUMN policy_fingerprint TEXT CHECK (policy_fingerprint IS NULL OR policy_fingerprint ~ '^[a-f0-9]{64}$'),
  ADD COLUMN provider_fingerprint TEXT CHECK (provider_fingerprint IS NULL OR provider_fingerprint ~ '^[a-f0-9]{64}$');
