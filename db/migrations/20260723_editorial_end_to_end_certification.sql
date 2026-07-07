ALTER TABLE factory_editorial_certification_runs
  DROP CONSTRAINT IF EXISTS factory_editorial_certification_runs_epic_check;
ALTER TABLE factory_editorial_certification_runs
  ADD CONSTRAINT factory_editorial_certification_runs_epic_check
  CHECK (epic IN ('EI-002', 'EI-003', 'EI-004', 'EI-END-TO-END'));
