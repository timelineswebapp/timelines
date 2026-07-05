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
      'candidate_context_record',
      'editorial_timeline_candidate'
    )
  );

ALTER TABLE evidence_validation_records
  ADD CONSTRAINT evidence_validation_records_id_evidence_unique
  UNIQUE (id, evidence_record_id);

CREATE TABLE factory_editorial_timeline_candidates (
  id UUID PRIMARY KEY,
  factory_object_id UUID NOT NULL UNIQUE REFERENCES factory_objects(id) ON DELETE RESTRICT,
  editorial_evidence_set_id UUID NOT NULL REFERENCES factory_editorial_evidence_sets(id) ON DELETE RESTRICT,
  canonical_subject TEXT NOT NULL CHECK (length(btrim(canonical_subject)) BETWEEN 1 AND 300),
  compiler_version TEXT NOT NULL CHECK (length(btrim(compiler_version)) BETWEEN 1 AND 100),
  selection_algorithm_version TEXT NOT NULL CHECK (length(btrim(selection_algorithm_version)) BETWEEN 1 AND 100),
  compiler_input_fingerprint TEXT NOT NULL CHECK (compiler_input_fingerprint ~ '^[a-f0-9]{64}$'),
  compiler_metadata JSONB NOT NULL CHECK (
    compiler_metadata->>'authorityDecision' = 'false'
    AND compiler_metadata->>'publicationReadinessDecision' = 'false'
  ),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (editorial_evidence_set_id, compiler_input_fingerprint)
);

CREATE TABLE factory_editorial_timeline_candidate_milestones (
  candidate_id UUID NOT NULL REFERENCES factory_editorial_timeline_candidates(id) ON DELETE RESTRICT,
  milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence > 0 AND sequence <= 200),
  selection_reasons JSONB NOT NULL CHECK (jsonb_typeof(selection_reasons) = 'array'),
  PRIMARY KEY (candidate_id, milestone_object_id),
  UNIQUE (candidate_id, sequence)
);

CREATE TABLE factory_editorial_timeline_candidate_evidence (
  candidate_id UUID NOT NULL,
  milestone_object_id UUID NOT NULL,
  evidence_record_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE RESTRICT,
  validation_record_id UUID NOT NULL,
  PRIMARY KEY (candidate_id, milestone_object_id, evidence_record_id, validation_record_id),
  FOREIGN KEY (candidate_id, milestone_object_id)
    REFERENCES factory_editorial_timeline_candidate_milestones(candidate_id, milestone_object_id)
    ON DELETE RESTRICT,
  FOREIGN KEY (validation_record_id, evidence_record_id)
    REFERENCES evidence_validation_records(id, evidence_record_id)
    ON DELETE RESTRICT
);

CREATE TABLE factory_editorial_timeline_candidate_exclusions (
  candidate_id UUID NOT NULL REFERENCES factory_editorial_timeline_candidates(id) ON DELETE RESTRICT,
  excluded_milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  canonical_milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  exclusion_reason TEXT NOT NULL CHECK (exclusion_reason = 'duplicate_of_canonical_milestone'),
  PRIMARY KEY (candidate_id, excluded_milestone_object_id),
  CHECK (excluded_milestone_object_id <> canonical_milestone_object_id)
);

CREATE INDEX idx_factory_editorial_timeline_candidates_created
  ON factory_editorial_timeline_candidates(created_at DESC, id);

CREATE INDEX idx_factory_editorial_timeline_milestones_object
  ON factory_editorial_timeline_candidate_milestones(milestone_object_id, candidate_id);

CREATE INDEX idx_factory_editorial_timeline_evidence_record
  ON factory_editorial_timeline_candidate_evidence(evidence_record_id, candidate_id);

CREATE INDEX idx_factory_editorial_timeline_exclusions_object
  ON factory_editorial_timeline_candidate_exclusions(excluded_milestone_object_id, candidate_id);

CREATE OR REPLACE FUNCTION enforce_editorial_timeline_candidate_integrity()
RETURNS TRIGGER AS $$
DECLARE
  checked_candidate_id UUID;
  sequence_count INTEGER;
  sequence_min INTEGER;
  sequence_max INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'factory_editorial_timeline_candidates' THEN
    checked_candidate_id := NEW.id;
  ELSE
    checked_candidate_id := NEW.candidate_id;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM factory_editorial_timeline_candidates candidate
    JOIN factory_objects object ON object.id = candidate.factory_object_id
    WHERE candidate.id = checked_candidate_id
      AND object.object_type <> 'editorial_timeline_candidate'
  ) THEN
    RAISE EXCEPTION 'EditorialTimelineCandidate must reference an editorial_timeline_candidate Factory object.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_editorial_timeline_candidate_milestones selected
    JOIN factory_objects object ON object.id = selected.milestone_object_id
    WHERE selected.candidate_id = checked_candidate_id
      AND object.object_type <> 'candidate_milestone'
  ) OR EXISTS (
    SELECT 1
    FROM factory_editorial_timeline_candidate_exclusions excluded
    JOIN factory_objects object
      ON object.id IN (excluded.excluded_milestone_object_id, excluded.canonical_milestone_object_id)
    WHERE excluded.candidate_id = checked_candidate_id
      AND object.object_type <> 'candidate_milestone'
  ) THEN
    RAISE EXCEPTION 'EditorialTimelineCandidate milestone references must target candidate_milestone Factory objects.';
  END IF;

  SELECT COUNT(*), MIN(sequence), MAX(sequence)
  INTO sequence_count, sequence_min, sequence_max
  FROM factory_editorial_timeline_candidate_milestones
  WHERE candidate_id = checked_candidate_id;

  IF sequence_count = 0 OR sequence_min <> 1 OR sequence_max <> sequence_count THEN
    RAISE EXCEPTION 'EditorialTimelineCandidate sequence positions must be contiguous from 1.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_editorial_timeline_candidate_exclusions excluded
    WHERE excluded.candidate_id = checked_candidate_id
      AND (
        EXISTS (
          SELECT 1 FROM factory_editorial_timeline_candidate_milestones selected
          WHERE selected.candidate_id = excluded.candidate_id
            AND selected.milestone_object_id = excluded.excluded_milestone_object_id
        )
        OR NOT EXISTS (
          SELECT 1 FROM factory_editorial_timeline_candidate_milestones selected
          WHERE selected.candidate_id = excluded.candidate_id
            AND selected.milestone_object_id = excluded.canonical_milestone_object_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'EditorialTimelineCandidate exclusions must reference one excluded and one selected canonical milestone.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER enforce_factory_editorial_timeline_candidate_integrity
AFTER INSERT ON factory_editorial_timeline_candidates
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_timeline_candidate_integrity();

CREATE CONSTRAINT TRIGGER enforce_factory_editorial_timeline_milestone_integrity
AFTER INSERT ON factory_editorial_timeline_candidate_milestones
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_timeline_candidate_integrity();

CREATE CONSTRAINT TRIGGER enforce_factory_editorial_timeline_exclusion_integrity
AFTER INSERT ON factory_editorial_timeline_candidate_exclusions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_timeline_candidate_integrity();

CREATE OR REPLACE FUNCTION prevent_editorial_timeline_candidate_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'EditorialTimelineCandidate Production Memory is immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_factory_editorial_timeline_candidates_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_timeline_candidates
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_timeline_candidate_mutation();

CREATE TRIGGER prevent_factory_editorial_timeline_milestones_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_timeline_candidate_milestones
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_timeline_candidate_mutation();

CREATE TRIGGER prevent_factory_editorial_timeline_evidence_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_timeline_candidate_evidence
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_timeline_candidate_mutation();

CREATE TRIGGER prevent_factory_editorial_timeline_exclusions_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_timeline_candidate_exclusions
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_timeline_candidate_mutation();

CREATE OR REPLACE FUNCTION prevent_editorial_timeline_factory_object_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.object_type = 'editorial_timeline_candidate' THEN
    RAISE EXCEPTION 'EditorialTimelineCandidate Factory objects are immutable.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_editorial_timeline_factory_object_update
BEFORE UPDATE ON factory_objects
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_timeline_factory_object_mutation();
