DROP TRIGGER IF EXISTS prevent_editorial_timeline_factory_object_update ON factory_objects;
DROP FUNCTION IF EXISTS prevent_editorial_timeline_factory_object_mutation();

DROP TRIGGER IF EXISTS enforce_factory_editorial_timeline_exclusion_integrity ON factory_editorial_timeline_candidate_exclusions;
DROP TRIGGER IF EXISTS enforce_factory_editorial_timeline_milestone_integrity ON factory_editorial_timeline_candidate_milestones;
DROP TRIGGER IF EXISTS enforce_factory_editorial_timeline_candidate_integrity ON factory_editorial_timeline_candidates;
DROP FUNCTION IF EXISTS enforce_editorial_timeline_candidate_integrity();

DROP TRIGGER IF EXISTS prevent_factory_editorial_timeline_exclusions_mutation ON factory_editorial_timeline_candidate_exclusions;
DROP TRIGGER IF EXISTS prevent_factory_editorial_timeline_evidence_mutation ON factory_editorial_timeline_candidate_evidence;
DROP TRIGGER IF EXISTS prevent_factory_editorial_timeline_milestones_mutation ON factory_editorial_timeline_candidate_milestones;
DROP TRIGGER IF EXISTS prevent_factory_editorial_timeline_candidates_mutation ON factory_editorial_timeline_candidates;

DROP TABLE IF EXISTS factory_editorial_timeline_candidate_exclusions;
DROP TABLE IF EXISTS factory_editorial_timeline_candidate_evidence;
DROP TABLE IF EXISTS factory_editorial_timeline_candidate_milestones;
DROP TABLE IF EXISTS factory_editorial_timeline_candidates;

DROP FUNCTION IF EXISTS prevent_editorial_timeline_candidate_mutation();

ALTER TABLE evidence_validation_records
  DROP CONSTRAINT IF EXISTS evidence_validation_records_id_evidence_unique;

ALTER TABLE factory_objects
  DROP CONSTRAINT IF EXISTS factory_objects_object_type_check;

ALTER TABLE factory_objects
  ADD CONSTRAINT factory_objects_object_type_check CHECK (
    object_type IN (
      'candidate_historical_object',
      'candidate_milestone',
      'candidate_participation',
      'candidate_relationship',
      'candidate_source',
      'candidate_context_record'
    )
  );
