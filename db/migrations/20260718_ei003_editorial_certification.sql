ALTER TABLE factory_editorial_certification_runs
  DROP CONSTRAINT IF EXISTS factory_editorial_certification_runs_epic_check;
ALTER TABLE factory_editorial_certification_runs
  ADD CONSTRAINT factory_editorial_certification_runs_epic_check
  CHECK (epic IN ('EI-002', 'EI-003'));

ALTER TABLE factory_editorial_certification_case_results
  ADD COLUMN planner_version TEXT,
  ADD COLUMN structure_algorithm_version TEXT,
  ADD COLUMN input_fingerprint TEXT CHECK (input_fingerprint IS NULL OR input_fingerprint ~ '^[a-f0-9]{64}$'),
  ADD COLUMN output_fingerprint TEXT CHECK (output_fingerprint IS NULL OR output_fingerprint ~ '^[a-f0-9]{64}$');
