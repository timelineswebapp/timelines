ALTER TABLE factory_editorial_certification_case_results
  DROP COLUMN IF EXISTS provider_fingerprint,
  DROP COLUMN IF EXISTS policy_fingerprint,
  DROP COLUMN IF EXISTS prompt_fingerprints,
  DROP COLUMN IF EXISTS revision_identity,
  DROP COLUMN IF EXISTS narrative_id,
  DROP COLUMN IF EXISTS execution_key,
  DROP COLUMN IF EXISTS generation_algorithm_version,
  DROP COLUMN IF EXISTS writer_version;
ALTER TABLE factory_editorial_certification_runs
  DROP CONSTRAINT IF EXISTS factory_editorial_certification_runs_epic_check;
ALTER TABLE factory_editorial_certification_runs
  ADD CONSTRAINT factory_editorial_certification_runs_epic_check
  CHECK (epic IN ('EI-002', 'EI-003'));
