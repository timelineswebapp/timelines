ALTER TABLE factory_objects DROP CONSTRAINT IF EXISTS factory_objects_object_type_check;
ALTER TABLE factory_objects ADD CONSTRAINT factory_objects_object_type_check CHECK (
  object_type IN ('candidate_historical_object','candidate_milestone','candidate_participation',
    'candidate_relationship','candidate_source','candidate_context_record',
    'editorial_timeline_candidate','editorial_composition','editorial_narrative')
);

ALTER TABLE factory_editorial_compositions
  ADD CONSTRAINT factory_editorial_composition_exact_lineage_unique
  UNIQUE (id, editorial_timeline_candidate_id, editorial_evidence_set_id, planner_input_fingerprint);

CREATE TABLE factory_editorial_narratives (
  id UUID PRIMARY KEY,
  factory_object_id UUID NOT NULL UNIQUE REFERENCES factory_objects(id) ON DELETE RESTRICT,
  editorial_composition_id UUID NOT NULL,
  editorial_timeline_candidate_id UUID NOT NULL,
  editorial_evidence_set_id UUID NOT NULL REFERENCES factory_editorial_evidence_sets(id) ON DELETE RESTRICT,
  canonical_subject TEXT NOT NULL CHECK (length(btrim(canonical_subject)) BETWEEN 1 AND 300),
  locale TEXT NOT NULL CHECK (length(btrim(locale)) BETWEEN 2 AND 35),
  contract_version TEXT NOT NULL,
  composition_fingerprint TEXT NOT NULL CHECK (composition_fingerprint ~ '^[a-f0-9]{64}$'),
  candidate_fingerprint TEXT NOT NULL CHECK (candidate_fingerprint ~ '^[a-f0-9]{64}$'),
  writer_input_fingerprint TEXT NOT NULL CHECK (writer_input_fingerprint ~ '^[a-f0-9]{64}$'),
  output_fingerprint TEXT NOT NULL UNIQUE CHECK (output_fingerprint ~ '^[a-f0-9]{64}$'),
  execution_key TEXT NOT NULL UNIQUE CHECK (length(btrim(execution_key)) BETWEEN 1 AND 300),
  writer_version TEXT NOT NULL CHECK (length(btrim(writer_version)) BETWEEN 1 AND 100),
  generation_algorithm_version TEXT NOT NULL CHECK (length(btrim(generation_algorithm_version)) BETWEEN 1 AND 100),
  persistence_version TEXT NOT NULL,
  title_text TEXT NOT NULL,
  title_claim_ids TEXT[] NOT NULL,
  title_milestone_ids UUID[] NOT NULL,
  subtitle_text TEXT,
  subtitle_claim_ids TEXT[],
  subtitle_milestone_ids UUID[],
  generation_metrics JSONB NOT NULL,
  generation_metadata JSONB NOT NULL CHECK (
    generation_metadata->>'factoryOwned' = 'true'
    AND generation_metadata->>'authorityDecision' = 'false'
    AND generation_metadata->>'publicationReadinessDecision' = 'false'
    AND generation_metadata->>'generatedText' = 'true'
  ),
  diagnostics JSONB NOT NULL CHECK (jsonb_typeof(diagnostics) = 'array' AND jsonb_array_length(diagnostics) <= 1000),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (editorial_composition_id, editorial_timeline_candidate_id,
    editorial_evidence_set_id, composition_fingerprint)
  REFERENCES factory_editorial_compositions (id, editorial_timeline_candidate_id,
    editorial_evidence_set_id, planner_input_fingerprint) ON DELETE RESTRICT
);

CREATE TABLE factory_editorial_narrative_prompt_refs (
  narrative_id UUID NOT NULL REFERENCES factory_editorial_narratives(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 20),
  prompt_id TEXT NOT NULL, prompt_key TEXT NOT NULL, prompt_version INTEGER NOT NULL,
  template_fingerprint TEXT NOT NULL, schema_version TEXT NOT NULL,
  policy_id TEXT NOT NULL, policy_version TEXT NOT NULL,
  lifecycle TEXT NOT NULL, prompt_fingerprint TEXT NOT NULL,
  PRIMARY KEY (narrative_id, position), UNIQUE (narrative_id, prompt_id, prompt_version)
);
CREATE TABLE factory_editorial_narrative_provenance (
  narrative_id UUID PRIMARY KEY REFERENCES factory_editorial_narratives(id) ON DELETE RESTRICT,
  writing_policy JSONB NOT NULL, provider_provenance JSONB NOT NULL
);
CREATE TABLE factory_editorial_narrative_sections (
  narrative_id UUID NOT NULL REFERENCES factory_editorial_narratives(id) ON DELETE RESTRICT,
  section_key TEXT NOT NULL, sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 202),
  section_type TEXT NOT NULL CHECK (section_type IN ('introduction','phase','conclusion')),
  composition_ref TEXT NOT NULL,
  PRIMARY KEY (narrative_id, section_key), UNIQUE (narrative_id, sequence)
);
CREATE TABLE factory_editorial_narrative_paragraphs (
  narrative_id UUID NOT NULL, section_key TEXT NOT NULL, paragraph_key TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 1000),
  PRIMARY KEY (narrative_id, paragraph_key), UNIQUE (narrative_id, section_key, sequence),
  FOREIGN KEY (narrative_id, section_key) REFERENCES factory_editorial_narrative_sections(narrative_id, section_key) ON DELETE RESTRICT
);
CREATE TABLE factory_editorial_narrative_paragraph_milestones (
  narrative_id UUID NOT NULL, paragraph_key TEXT NOT NULL,
  milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 200),
  PRIMARY KEY (narrative_id, paragraph_key, milestone_object_id),
  UNIQUE (narrative_id, paragraph_key, position),
  FOREIGN KEY (narrative_id, paragraph_key) REFERENCES factory_editorial_narrative_paragraphs(narrative_id, paragraph_key) ON DELETE RESTRICT
);
CREATE TABLE factory_editorial_narrative_sentences (
  narrative_id UUID NOT NULL, paragraph_key TEXT NOT NULL, sentence_key TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 1000), text TEXT NOT NULL,
  chronology_refs TEXT[] NOT NULL,
  PRIMARY KEY (narrative_id, sentence_key), UNIQUE (narrative_id, paragraph_key, sequence),
  FOREIGN KEY (narrative_id, paragraph_key) REFERENCES factory_editorial_narrative_paragraphs(narrative_id, paragraph_key) ON DELETE RESTRICT
);
CREATE TABLE factory_editorial_narrative_sentence_claims (
  narrative_id UUID NOT NULL, sentence_key TEXT NOT NULL, claim_id TEXT NOT NULL,
  evidence_record_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 1000),
  PRIMARY KEY (narrative_id, sentence_key, claim_id),
  FOREIGN KEY (narrative_id, sentence_key) REFERENCES factory_editorial_narrative_sentences(narrative_id, sentence_key) ON DELETE RESTRICT
);
CREATE TABLE factory_editorial_narrative_sentence_milestones (
  narrative_id UUID NOT NULL, sentence_key TEXT NOT NULL,
  milestone_object_id UUID NOT NULL REFERENCES factory_objects(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 200),
  PRIMARY KEY (narrative_id, sentence_key, milestone_object_id),
  FOREIGN KEY (narrative_id, sentence_key) REFERENCES factory_editorial_narrative_sentences(narrative_id, sentence_key) ON DELETE RESTRICT
);
CREATE TABLE factory_editorial_narrative_citations (
  narrative_id UUID NOT NULL REFERENCES factory_editorial_narratives(id) ON DELETE RESTRICT,
  citation_key TEXT NOT NULL, source_record_id UUID NOT NULL REFERENCES source_authority_records(id) ON DELETE RESTRICT,
  source_snapshot_id UUID NOT NULL REFERENCES source_authority_snapshots(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10000),
  PRIMARY KEY (narrative_id, citation_key), UNIQUE (narrative_id, position)
);
CREATE TABLE factory_editorial_narrative_citation_sentences (
  narrative_id UUID NOT NULL, citation_key TEXT NOT NULL, sentence_key TEXT NOT NULL,
  position INTEGER NOT NULL, PRIMARY KEY (narrative_id, citation_key, sentence_key),
  FOREIGN KEY (narrative_id, citation_key) REFERENCES factory_editorial_narrative_citations(narrative_id, citation_key) ON DELETE RESTRICT,
  FOREIGN KEY (narrative_id, sentence_key) REFERENCES factory_editorial_narrative_sentences(narrative_id, sentence_key) ON DELETE RESTRICT
);
CREATE TABLE factory_editorial_narrative_citation_evidence (
  narrative_id UUID NOT NULL, citation_key TEXT NOT NULL,
  evidence_record_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL, PRIMARY KEY (narrative_id, citation_key, evidence_record_id),
  FOREIGN KEY (narrative_id, citation_key) REFERENCES factory_editorial_narrative_citations(narrative_id, citation_key) ON DELETE RESTRICT
);
CREATE TABLE factory_editorial_narrative_revisions (
  narrative_id UUID PRIMARY KEY REFERENCES factory_editorial_narratives(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  supersedes_narrative_id UUID REFERENCES factory_editorial_narratives(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  CHECK (narrative_id <> supersedes_narrative_id)
);

CREATE INDEX idx_factory_editorial_narratives_execution ON factory_editorial_narratives(execution_key);
CREATE INDEX idx_factory_editorial_narratives_output ON factory_editorial_narratives(output_fingerprint);
CREATE INDEX idx_factory_editorial_narrative_sentences_parent ON factory_editorial_narrative_sentences(narrative_id, paragraph_key, sequence);
CREATE INDEX idx_factory_editorial_narrative_claim_evidence ON factory_editorial_narrative_sentence_claims(evidence_record_id, narrative_id);

CREATE OR REPLACE FUNCTION enforce_editorial_narrative_integrity() RETURNS TRIGGER AS $$
DECLARE nid UUID; section_count INTEGER; milestone_count INTEGER; selected_count INTEGER; inserted_row JSONB;
BEGIN
  inserted_row := to_jsonb(NEW);
  nid := COALESCE((inserted_row->>'narrative_id')::UUID, (inserted_row->>'id')::UUID);
  IF nid IS NULL THEN
    RAISE EXCEPTION 'EditorialNarrative integrity trigger could not resolve narrative id.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM factory_editorial_narratives n JOIN factory_objects o ON o.id=n.factory_object_id
    WHERE n.id=nid AND o.object_type='editorial_narrative') THEN
    RAISE EXCEPTION 'EditorialNarrative must own an editorial_narrative Factory object.';
  END IF;
  IF EXISTS (SELECT 1 FROM factory_editorial_narrative_sections s WHERE s.narrative_id=nid
    GROUP BY s.narrative_id HAVING min(sequence)<>1 OR max(sequence)<>count(*)) THEN
    RAISE EXCEPTION 'EditorialNarrative section ordering must be contiguous.';
  END IF;
  IF EXISTS (SELECT 1 FROM factory_editorial_narrative_paragraphs p WHERE p.narrative_id=nid
    GROUP BY p.section_key HAVING min(sequence)<>1 OR max(sequence)<>count(*)) THEN
    RAISE EXCEPTION 'EditorialNarrative paragraph ordering must be contiguous.';
  END IF;
  IF EXISTS (SELECT 1 FROM factory_editorial_narrative_sentences s WHERE s.narrative_id=nid
    GROUP BY s.paragraph_key HAVING min(sequence)<>1 OR max(sequence)<>count(*)) THEN
    RAISE EXCEPTION 'EditorialNarrative sentence ordering must be contiguous.';
  END IF;
  SELECT count(DISTINCT sm.milestone_object_id) INTO milestone_count
    FROM factory_editorial_narrative_sentence_milestones sm WHERE sm.narrative_id=nid;
  SELECT count(*) INTO selected_count FROM factory_editorial_composition_phase_milestones cm
    JOIN factory_editorial_narratives n ON n.editorial_composition_id=cm.composition_id WHERE n.id=nid;
  IF milestone_count <> selected_count OR EXISTS (
    SELECT cm.milestone_object_id FROM factory_editorial_composition_phase_milestones cm
      JOIN factory_editorial_narratives n ON n.editorial_composition_id=cm.composition_id WHERE n.id=nid
    EXCEPT SELECT sm.milestone_object_id FROM factory_editorial_narrative_sentence_milestones sm WHERE sm.narrative_id=nid
  ) THEN RAISE EXCEPTION 'Every selected milestone must be covered by EditorialNarrative.'; END IF;
  IF EXISTS (SELECT 1 FROM factory_editorial_narrative_sentence_milestones sm
    JOIN factory_editorial_narratives n ON n.id=sm.narrative_id
    JOIN factory_editorial_timeline_candidate_exclusions x ON x.candidate_id=n.editorial_timeline_candidate_id
      AND x.excluded_milestone_object_id=sm.milestone_object_id WHERE sm.narrative_id=nid)
  THEN RAISE EXCEPTION 'Excluded milestones cannot be referenced by EditorialNarrative.'; END IF;
  IF EXISTS (SELECT 1 FROM factory_editorial_narrative_sentence_claims sc
    JOIN factory_editorial_narratives n ON n.id=sc.narrative_id
    LEFT JOIN factory_editorial_evidence_set_inputs ei ON ei.editorial_evidence_set_id=n.editorial_evidence_set_id
      AND ei.evidence_record_id=sc.evidence_record_id
    WHERE sc.narrative_id=nid AND ei.evidence_record_id IS NULL)
  THEN RAISE EXCEPTION 'Narrative claims must belong to the pinned EditorialEvidenceSet.'; END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER enforce_factory_editorial_narrative_integrity
AFTER INSERT ON factory_editorial_narratives DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_narrative_integrity();
CREATE CONSTRAINT TRIGGER enforce_factory_editorial_narrative_sentence_integrity
AFTER INSERT ON factory_editorial_narrative_sentence_milestones DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_narrative_integrity();

CREATE OR REPLACE FUNCTION prevent_editorial_narrative_mutation() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'EditorialNarrative Production Memory is immutable.'; END $$ LANGUAGE plpgsql;
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY[
 'factory_editorial_narratives','factory_editorial_narrative_prompt_refs','factory_editorial_narrative_provenance',
 'factory_editorial_narrative_sections','factory_editorial_narrative_paragraphs','factory_editorial_narrative_paragraph_milestones',
 'factory_editorial_narrative_sentences','factory_editorial_narrative_sentence_claims','factory_editorial_narrative_sentence_milestones',
 'factory_editorial_narrative_citations','factory_editorial_narrative_citation_sentences',
 'factory_editorial_narrative_citation_evidence','factory_editorial_narrative_revisions'
] LOOP EXECUTE format('CREATE TRIGGER prevent_%s_mutation BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_editorial_narrative_mutation()', t, t); END LOOP; END $$;

CREATE OR REPLACE FUNCTION prevent_editorial_narrative_factory_object_mutation() RETURNS TRIGGER AS $$
BEGIN IF OLD.object_type='editorial_narrative' THEN RAISE EXCEPTION 'EditorialNarrative Factory objects are immutable.'; END IF;
RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END $$ LANGUAGE plpgsql;
CREATE TRIGGER prevent_editorial_narrative_factory_object_update BEFORE UPDATE OR DELETE ON factory_objects
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_narrative_factory_object_mutation();
