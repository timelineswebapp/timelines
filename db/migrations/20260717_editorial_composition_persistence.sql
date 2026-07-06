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
      'editorial_timeline_candidate',
      'editorial_composition'
    )
  );

ALTER TABLE factory_editorial_timeline_candidates
  ADD CONSTRAINT factory_editorial_timeline_candidate_exact_lineage_unique
  UNIQUE (id, editorial_evidence_set_id, compiler_input_fingerprint);

CREATE TABLE factory_editorial_compositions (
  id UUID PRIMARY KEY,
  factory_object_id UUID NOT NULL UNIQUE REFERENCES factory_objects(id) ON DELETE RESTRICT,
  editorial_timeline_candidate_id UUID NOT NULL,
  editorial_evidence_set_id UUID NOT NULL REFERENCES factory_editorial_evidence_sets(id) ON DELETE RESTRICT,
  canonical_subject TEXT NOT NULL CHECK (length(btrim(canonical_subject)) BETWEEN 1 AND 300),
  editorial_timeline_candidate_fingerprint TEXT NOT NULL
    CHECK (editorial_timeline_candidate_fingerprint ~ '^[a-f0-9]{64}$'),
  planner_version TEXT NOT NULL CHECK (length(btrim(planner_version)) BETWEEN 1 AND 100),
  structure_algorithm_version TEXT NOT NULL CHECK (length(btrim(structure_algorithm_version)) BETWEEN 1 AND 100),
  planner_input_fingerprint TEXT NOT NULL CHECK (planner_input_fingerprint ~ '^[a-f0-9]{64}$'),
  composition_metadata JSONB NOT NULL CHECK (
    composition_metadata->>'authorityDecision' = 'false'
    AND composition_metadata->>'publicationReadinessDecision' = 'false'
    AND composition_metadata->>'generatedText' = 'false'
  ),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (editorial_timeline_candidate_id, planner_input_fingerprint),
  FOREIGN KEY (
    editorial_timeline_candidate_id,
    editorial_evidence_set_id,
    editorial_timeline_candidate_fingerprint
  ) REFERENCES factory_editorial_timeline_candidates (
    id,
    editorial_evidence_set_id,
    compiler_input_fingerprint
  ) ON DELETE RESTRICT
);

CREATE TABLE factory_editorial_composition_phases (
  composition_id UUID NOT NULL REFERENCES factory_editorial_compositions(id) ON DELETE RESTRICT,
  phase_key TEXT NOT NULL CHECK (length(btrim(phase_key)) BETWEEN 1 AND 100),
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 200),
  start_milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  end_milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  basis TEXT NOT NULL CHECK (basis IN (
    'timeline_opening',
    'turning_point_boundary',
    'chronology_gap_boundary'
  )),
  PRIMARY KEY (composition_id, phase_key),
  UNIQUE (composition_id, sequence)
);

CREATE TABLE factory_editorial_composition_phase_milestones (
  composition_id UUID NOT NULL,
  phase_key TEXT NOT NULL,
  milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 200),
  PRIMARY KEY (composition_id, milestone_object_id),
  UNIQUE (composition_id, phase_key, position),
  FOREIGN KEY (composition_id, phase_key)
    REFERENCES factory_editorial_composition_phases(composition_id, phase_key)
    ON DELETE RESTRICT
);

CREATE TABLE factory_editorial_composition_boundaries (
  composition_id UUID NOT NULL REFERENCES factory_editorial_compositions(id) ON DELETE RESTRICT,
  boundary_type TEXT NOT NULL CHECK (boundary_type IN ('introduction', 'conclusion')),
  anchor_milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose IN (
    'establish_initial_conditions',
    'establish_historical_outcome'
  )),
  PRIMARY KEY (composition_id, boundary_type)
);

CREATE TABLE factory_editorial_composition_turning_points (
  composition_id UUID NOT NULL REFERENCES factory_editorial_compositions(id) ON DELETE RESTRICT,
  milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  evidence_record_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE RESTRICT,
  phase_before_key TEXT,
  phase_after_key TEXT,
  source TEXT NOT NULL CHECK (source = 'ei_001_identified_turning_point'),
  PRIMARY KEY (composition_id, milestone_object_id, evidence_record_id),
  FOREIGN KEY (composition_id, phase_before_key)
    REFERENCES factory_editorial_composition_phases(composition_id, phase_key)
    ON DELETE RESTRICT,
  FOREIGN KEY (composition_id, phase_after_key)
    REFERENCES factory_editorial_composition_phases(composition_id, phase_key)
    ON DELETE RESTRICT
);

CREATE TABLE factory_editorial_composition_transitions (
  composition_id UUID NOT NULL REFERENCES factory_editorial_compositions(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 199),
  from_phase_key TEXT NOT NULL,
  to_phase_key TEXT NOT NULL,
  boundary_milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  transition_type TEXT NOT NULL CHECK (transition_type IN (
    'turning_point_transition',
    'chronology_gap_transition'
  )),
  PRIMARY KEY (composition_id, sequence),
  UNIQUE (composition_id, from_phase_key, to_phase_key),
  FOREIGN KEY (composition_id, from_phase_key)
    REFERENCES factory_editorial_composition_phases(composition_id, phase_key)
    ON DELETE RESTRICT,
  FOREIGN KEY (composition_id, to_phase_key)
    REFERENCES factory_editorial_composition_phases(composition_id, phase_key)
    ON DELETE RESTRICT
);

CREATE TABLE factory_editorial_composition_continuity (
  composition_id UUID NOT NULL REFERENCES factory_editorial_compositions(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 199),
  from_milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  to_milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  basis TEXT NOT NULL CHECK (basis = 'chronological_adjacency'),
  PRIMARY KEY (composition_id, sequence),
  UNIQUE (composition_id, from_milestone_object_id, to_milestone_object_id),
  CHECK (from_milestone_object_id <> to_milestone_object_id)
);

CREATE TABLE factory_editorial_composition_arcs (
  composition_id UUID NOT NULL REFERENCES factory_editorial_compositions(id) ON DELETE RESTRICT,
  arc_key TEXT NOT NULL CHECK (length(btrim(arc_key)) BETWEEN 1 AND 100),
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 200),
  basis TEXT NOT NULL CHECK (basis = 'full_timeline_arc'),
  PRIMARY KEY (composition_id, arc_key),
  UNIQUE (composition_id, sequence)
);

CREATE TABLE factory_editorial_composition_arc_phases (
  composition_id UUID NOT NULL,
  arc_key TEXT NOT NULL,
  phase_key TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 200),
  PRIMARY KEY (composition_id, arc_key, phase_key),
  UNIQUE (composition_id, arc_key, position),
  FOREIGN KEY (composition_id, arc_key)
    REFERENCES factory_editorial_composition_arcs(composition_id, arc_key)
    ON DELETE RESTRICT,
  FOREIGN KEY (composition_id, phase_key)
    REFERENCES factory_editorial_composition_phases(composition_id, phase_key)
    ON DELETE RESTRICT
);

CREATE TABLE factory_editorial_composition_arc_milestones (
  composition_id UUID NOT NULL,
  arc_key TEXT NOT NULL,
  milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 200),
  PRIMARY KEY (composition_id, arc_key, milestone_object_id),
  UNIQUE (composition_id, arc_key, position),
  FOREIGN KEY (composition_id, arc_key)
    REFERENCES factory_editorial_composition_arcs(composition_id, arc_key)
    ON DELETE RESTRICT
);

CREATE INDEX idx_factory_editorial_compositions_created
  ON factory_editorial_compositions(created_at DESC, id);
CREATE INDEX idx_factory_editorial_composition_phase_milestones_object
  ON factory_editorial_composition_phase_milestones(milestone_object_id, composition_id);
CREATE INDEX idx_factory_editorial_composition_turning_evidence
  ON factory_editorial_composition_turning_points(evidence_record_id, composition_id);

CREATE OR REPLACE FUNCTION enforce_editorial_composition_integrity()
RETURNS TRIGGER AS $$
DECLARE
  checked_composition_id UUID;
  predecessor_candidate_id UUID;
  phase_count INTEGER;
  phase_min INTEGER;
  phase_max INTEGER;
  selected_count INTEGER;
  membership_count INTEGER;
BEGIN
  checked_composition_id := CASE
    WHEN TG_TABLE_NAME = 'factory_editorial_compositions' THEN NEW.id
    ELSE NEW.composition_id
  END;

  SELECT editorial_timeline_candidate_id
  INTO predecessor_candidate_id
  FROM factory_editorial_compositions
  WHERE id = checked_composition_id;

  IF NOT EXISTS (
    SELECT 1
    FROM factory_editorial_compositions composition
    JOIN factory_objects object ON object.id = composition.factory_object_id
    WHERE composition.id = checked_composition_id
      AND object.object_type = 'editorial_composition'
  ) THEN
    RAISE EXCEPTION 'EditorialComposition must reference an editorial_composition Factory object.';
  END IF;

  SELECT COUNT(*), MIN(sequence), MAX(sequence)
  INTO phase_count, phase_min, phase_max
  FROM factory_editorial_composition_phases
  WHERE composition_id = checked_composition_id;

  IF phase_count = 0 OR phase_min <> 1 OR phase_max <> phase_count THEN
    RAISE EXCEPTION 'EditorialComposition phase ordering must be contiguous from 1.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_editorial_composition_phases phase
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count, MIN(position) AS minimum, MAX(position) AS maximum
      FROM factory_editorial_composition_phase_milestones membership
      WHERE membership.composition_id = phase.composition_id
        AND membership.phase_key = phase.phase_key
    ) positions ON TRUE
    WHERE phase.composition_id = checked_composition_id
      AND (positions.count = 0 OR positions.minimum <> 1 OR positions.maximum <> positions.count)
  ) THEN
    RAISE EXCEPTION 'EditorialComposition milestone ordering inside phases must be contiguous from 1.';
  END IF;

  SELECT COUNT(*) INTO selected_count
  FROM factory_editorial_timeline_candidate_milestones
  WHERE candidate_id = predecessor_candidate_id;

  SELECT COUNT(*) INTO membership_count
  FROM factory_editorial_composition_phase_milestones
  WHERE composition_id = checked_composition_id;

  IF membership_count <> selected_count OR EXISTS (
    SELECT milestone_object_id
    FROM factory_editorial_timeline_candidate_milestones
    WHERE candidate_id = predecessor_candidate_id
    EXCEPT
    SELECT milestone_object_id
    FROM factory_editorial_composition_phase_milestones
    WHERE composition_id = checked_composition_id
  ) THEN
    RAISE EXCEPTION 'Every selected EI-002 milestone must appear exactly once in EditorialComposition.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_editorial_composition_phase_milestones membership
    JOIN factory_editorial_timeline_candidate_exclusions exclusion
      ON exclusion.candidate_id = predecessor_candidate_id
      AND exclusion.excluded_milestone_object_id = membership.milestone_object_id
    WHERE membership.composition_id = checked_composition_id
  ) THEN
    RAISE EXCEPTION 'Excluded EI-002 milestones cannot appear in EditorialComposition.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_editorial_composition_phase_milestones membership
    JOIN factory_objects object ON object.id = membership.milestone_object_id
    WHERE membership.composition_id = checked_composition_id
      AND object.object_type <> 'candidate_milestone'
  ) THEN
    RAISE EXCEPTION 'EditorialComposition milestone references must target candidate_milestone Factory objects.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM factory_editorial_composition_turning_points turning
    WHERE turning.composition_id = checked_composition_id
      AND NOT EXISTS (
        SELECT 1
        FROM factory_editorial_timeline_candidate_evidence evidence
        WHERE evidence.candidate_id = predecessor_candidate_id
          AND evidence.milestone_object_id = turning.milestone_object_id
          AND evidence.evidence_record_id = turning.evidence_record_id
      )
  ) THEN
    RAISE EXCEPTION 'EditorialComposition turning points require exact EI-001 evidence lineage.';
  END IF;

  IF (SELECT COUNT(*) FROM factory_editorial_composition_boundaries WHERE composition_id = checked_composition_id) <> 2 THEN
    RAISE EXCEPTION 'EditorialComposition requires introduction and conclusion boundaries.';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER enforce_factory_editorial_composition_integrity
AFTER INSERT ON factory_editorial_compositions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_composition_integrity();

CREATE CONSTRAINT TRIGGER enforce_factory_editorial_composition_phase_integrity
AFTER INSERT ON factory_editorial_composition_phases
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_composition_integrity();

CREATE CONSTRAINT TRIGGER enforce_factory_editorial_composition_membership_integrity
AFTER INSERT ON factory_editorial_composition_phase_milestones
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_composition_integrity();

CREATE OR REPLACE FUNCTION prevent_editorial_composition_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'EditorialComposition Production Memory is immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_factory_editorial_compositions_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_compositions
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();
CREATE TRIGGER prevent_factory_editorial_composition_phases_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_composition_phases
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();
CREATE TRIGGER prevent_factory_editorial_composition_phase_milestones_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_composition_phase_milestones
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();
CREATE TRIGGER prevent_factory_editorial_composition_boundaries_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_composition_boundaries
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();
CREATE TRIGGER prevent_factory_editorial_composition_turning_points_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_composition_turning_points
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();
CREATE TRIGGER prevent_factory_editorial_composition_transitions_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_composition_transitions
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();
CREATE TRIGGER prevent_factory_editorial_composition_continuity_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_composition_continuity
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();
CREATE TRIGGER prevent_factory_editorial_composition_arcs_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_composition_arcs
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();
CREATE TRIGGER prevent_factory_editorial_composition_arc_phases_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_composition_arc_phases
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();
CREATE TRIGGER prevent_factory_editorial_composition_arc_milestones_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_composition_arc_milestones
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_mutation();

CREATE OR REPLACE FUNCTION prevent_editorial_composition_factory_object_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.object_type = 'editorial_composition' THEN
    RAISE EXCEPTION 'EditorialComposition Factory objects are immutable.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_editorial_composition_factory_object_update
BEFORE UPDATE OR DELETE ON factory_objects
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_composition_factory_object_mutation();
