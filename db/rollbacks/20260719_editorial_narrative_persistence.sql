DROP TRIGGER IF EXISTS prevent_editorial_narrative_factory_object_update ON factory_objects;
DROP FUNCTION IF EXISTS prevent_editorial_narrative_factory_object_mutation();
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY[
 'factory_editorial_narratives','factory_editorial_narrative_prompt_refs','factory_editorial_narrative_provenance',
 'factory_editorial_narrative_sections','factory_editorial_narrative_paragraphs','factory_editorial_narrative_paragraph_milestones',
 'factory_editorial_narrative_sentences','factory_editorial_narrative_sentence_claims','factory_editorial_narrative_sentence_milestones',
 'factory_editorial_narrative_citations','factory_editorial_narrative_citation_sentences',
 'factory_editorial_narrative_citation_evidence','factory_editorial_narrative_revisions'
] LOOP EXECUTE format('DROP TRIGGER IF EXISTS prevent_%s_mutation ON %I', t, t); END LOOP; END $$;
DROP TRIGGER IF EXISTS enforce_factory_editorial_narrative_sentence_integrity ON factory_editorial_narrative_sentence_milestones;
DROP TRIGGER IF EXISTS enforce_factory_editorial_narrative_integrity ON factory_editorial_narratives;
DROP FUNCTION IF EXISTS enforce_editorial_narrative_integrity();
DROP TABLE IF EXISTS factory_editorial_narrative_revisions;
DROP TABLE IF EXISTS factory_editorial_narrative_citation_evidence;
DROP TABLE IF EXISTS factory_editorial_narrative_citation_sentences;
DROP TABLE IF EXISTS factory_editorial_narrative_citations;
DROP TABLE IF EXISTS factory_editorial_narrative_sentence_milestones;
DROP TABLE IF EXISTS factory_editorial_narrative_sentence_claims;
DROP TABLE IF EXISTS factory_editorial_narrative_sentences;
DROP TABLE IF EXISTS factory_editorial_narrative_paragraph_milestones;
DROP TABLE IF EXISTS factory_editorial_narrative_paragraphs;
DROP TABLE IF EXISTS factory_editorial_narrative_sections;
DROP TABLE IF EXISTS factory_editorial_narrative_provenance;
DROP TABLE IF EXISTS factory_editorial_narrative_prompt_refs;
DROP TABLE IF EXISTS factory_editorial_narratives;
DROP FUNCTION IF EXISTS prevent_editorial_narrative_mutation();
ALTER TABLE factory_editorial_compositions DROP CONSTRAINT IF EXISTS factory_editorial_composition_exact_lineage_unique;
ALTER TABLE factory_objects DROP CONSTRAINT IF EXISTS factory_objects_object_type_check;
ALTER TABLE factory_objects ADD CONSTRAINT factory_objects_object_type_check CHECK (
 object_type IN ('candidate_historical_object','candidate_milestone','candidate_participation',
 'candidate_relationship','candidate_source','candidate_context_record',
 'editorial_timeline_candidate','editorial_composition')
);
