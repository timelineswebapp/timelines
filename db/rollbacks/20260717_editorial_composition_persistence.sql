DROP TRIGGER IF EXISTS prevent_editorial_composition_factory_object_update ON factory_objects;
DROP FUNCTION IF EXISTS prevent_editorial_composition_factory_object_mutation();

DROP TRIGGER IF EXISTS enforce_factory_editorial_composition_membership_integrity ON factory_editorial_composition_phase_milestones;
DROP TRIGGER IF EXISTS enforce_factory_editorial_composition_phase_integrity ON factory_editorial_composition_phases;
DROP TRIGGER IF EXISTS enforce_factory_editorial_composition_integrity ON factory_editorial_compositions;
DROP FUNCTION IF EXISTS enforce_editorial_composition_integrity();

DROP TRIGGER IF EXISTS prevent_factory_editorial_composition_arc_milestones_mutation ON factory_editorial_composition_arc_milestones;
DROP TRIGGER IF EXISTS prevent_factory_editorial_composition_arc_phases_mutation ON factory_editorial_composition_arc_phases;
DROP TRIGGER IF EXISTS prevent_factory_editorial_composition_arcs_mutation ON factory_editorial_composition_arcs;
DROP TRIGGER IF EXISTS prevent_factory_editorial_composition_continuity_mutation ON factory_editorial_composition_continuity;
DROP TRIGGER IF EXISTS prevent_factory_editorial_composition_transitions_mutation ON factory_editorial_composition_transitions;
DROP TRIGGER IF EXISTS prevent_factory_editorial_composition_turning_points_mutation ON factory_editorial_composition_turning_points;
DROP TRIGGER IF EXISTS prevent_factory_editorial_composition_boundaries_mutation ON factory_editorial_composition_boundaries;
DROP TRIGGER IF EXISTS prevent_factory_editorial_composition_phase_milestones_mutation ON factory_editorial_composition_phase_milestones;
DROP TRIGGER IF EXISTS prevent_factory_editorial_composition_phases_mutation ON factory_editorial_composition_phases;
DROP TRIGGER IF EXISTS prevent_factory_editorial_compositions_mutation ON factory_editorial_compositions;

DROP TABLE IF EXISTS factory_editorial_composition_arc_milestones;
DROP TABLE IF EXISTS factory_editorial_composition_arc_phases;
DROP TABLE IF EXISTS factory_editorial_composition_arcs;
DROP TABLE IF EXISTS factory_editorial_composition_continuity;
DROP TABLE IF EXISTS factory_editorial_composition_transitions;
DROP TABLE IF EXISTS factory_editorial_composition_turning_points;
DROP TABLE IF EXISTS factory_editorial_composition_boundaries;
DROP TABLE IF EXISTS factory_editorial_composition_phase_milestones;
DROP TABLE IF EXISTS factory_editorial_composition_phases;
DROP TABLE IF EXISTS factory_editorial_compositions;

DROP FUNCTION IF EXISTS prevent_editorial_composition_mutation();

ALTER TABLE factory_editorial_timeline_candidates
  DROP CONSTRAINT IF EXISTS factory_editorial_timeline_candidate_exact_lineage_unique;

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
