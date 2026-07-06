ALTER TABLE factory_editorial_certification_case_results
  DROP COLUMN IF EXISTS output_fingerprint,
  DROP COLUMN IF EXISTS input_fingerprint,
  DROP COLUMN IF EXISTS structure_algorithm_version,
  DROP COLUMN IF EXISTS planner_version;

ALTER TABLE factory_editorial_certification_runs
  DROP CONSTRAINT IF EXISTS factory_editorial_certification_runs_epic_check;
ALTER TABLE factory_editorial_certification_runs
  ADD CONSTRAINT factory_editorial_certification_runs_epic_check
  CHECK (epic = 'EI-002');
