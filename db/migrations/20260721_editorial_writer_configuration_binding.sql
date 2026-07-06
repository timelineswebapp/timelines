ALTER TABLE editorial_prompt_versions
  ADD COLUMN policy_id TEXT NOT NULL,
  ADD COLUMN policy_version TEXT NOT NULL;

ALTER TABLE editorial_writing_policies
  ADD COLUMN schema_version TEXT NOT NULL,
  ADD COLUMN target_length JSONB NOT NULL CHECK (
    jsonb_typeof(target_length) = 'object'
    AND (target_length->>'minimumWords')::integer > 0
    AND (target_length->>'maximumWords')::integer >= (target_length->>'minimumWords')::integer
  ),
  ADD COLUMN narrative_mode TEXT NOT NULL CHECK (narrative_mode IN (
    'historical_article','museum','educational','academic','executive_summary'
  ));

ALTER TABLE editorial_provider_configurations
  ADD COLUMN schema_version TEXT NOT NULL,
  ADD COLUMN provider_version TEXT NOT NULL,
  ADD COLUMN model_version TEXT NOT NULL,
  ADD COLUMN temperature DOUBLE PRECISION NOT NULL CHECK (temperature BETWEEN 0 AND 2),
  ADD COLUMN seed INTEGER;

CREATE TABLE editorial_writer_configuration_bindings (
  id UUID PRIMARY KEY,
  title_prompt_version_id UUID NOT NULL REFERENCES editorial_prompt_versions(id) ON DELETE RESTRICT,
  introduction_prompt_version_id UUID NOT NULL REFERENCES editorial_prompt_versions(id) ON DELETE RESTRICT,
  phase_prompt_version_id UUID NOT NULL REFERENCES editorial_prompt_versions(id) ON DELETE RESTRICT,
  conclusion_prompt_version_id UUID NOT NULL REFERENCES editorial_prompt_versions(id) ON DELETE RESTRICT,
  writing_policy_version_id UUID NOT NULL REFERENCES editorial_writing_policies(id) ON DELETE RESTRICT,
  provider_configuration_id UUID NOT NULL REFERENCES editorial_provider_configurations(id) ON DELETE RESTRICT,
  locale TEXT NOT NULL,
  narrative_mode TEXT NOT NULL CHECK (narrative_mode IN (
    'historical_article','museum','educational','academic','executive_summary'
  )),
  binding_fingerprint TEXT NOT NULL UNIQUE CHECK (binding_fingerprint ~ '^[a-f0-9]{64}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE editorial_writer_configuration_binding_supersessions (
  superseded_binding_id UUID PRIMARY KEY REFERENCES editorial_writer_configuration_bindings(id) ON DELETE RESTRICT,
  successor_binding_id UUID NOT NULL UNIQUE REFERENCES editorial_writer_configuration_bindings(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (superseded_binding_id <> successor_binding_id)
);

CREATE TABLE factory_editorial_generation_units (
  id UUID PRIMARY KEY,
  execution_key TEXT NOT NULL CHECK (length(btrim(execution_key)) BETWEEN 1 AND 300),
  unit_type TEXT NOT NULL CHECK (unit_type IN ('title','subtitle','introduction','phase','conclusion')),
  unit_sequence INTEGER NOT NULL CHECK (unit_sequence BETWEEN 1 AND 1000),
  prompt_version_id UUID NOT NULL REFERENCES editorial_prompt_versions(id) ON DELETE RESTRICT,
  input_fingerprint TEXT NOT NULL CHECK (input_fingerprint ~ '^[a-f0-9]{64}$'),
  output_fingerprint TEXT NOT NULL UNIQUE CHECK (output_fingerprint ~ '^[a-f0-9]{64}$'),
  validated_output JSONB NOT NULL CHECK (jsonb_typeof(validated_output) = 'object'),
  grounding_validation_report JSONB NOT NULL CHECK (
    jsonb_typeof(grounding_validation_report) = 'object'
    AND grounding_validation_report->>'passed' = 'true'
  ),
  diagnostics JSONB NOT NULL CHECK (jsonb_typeof(diagnostics) = 'object'),
  status TEXT NOT NULL CHECK (status = 'validated'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (execution_key, unit_type, unit_sequence),
  UNIQUE (execution_key, input_fingerprint)
);

CREATE INDEX idx_editorial_writer_binding_active
  ON editorial_writer_configuration_binding_supersessions(superseded_binding_id, successor_binding_id);
CREATE INDEX idx_factory_editorial_generation_units_execution
  ON factory_editorial_generation_units(execution_key, unit_sequence);

CREATE OR REPLACE FUNCTION enforce_editorial_writer_binding_lineage()
RETURNS TRIGGER AS $$
DECLARE
  policy_record editorial_writing_policies%ROWTYPE;
BEGIN
  SELECT * INTO policy_record FROM editorial_writing_policies WHERE id = NEW.writing_policy_version_id;
  IF policy_record.locale <> NEW.locale OR policy_record.narrative_mode <> NEW.narrative_mode THEN
    RAISE EXCEPTION 'Writer configuration binding locale and narrative mode must match its exact policy.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES
      (NEW.title_prompt_version_id, 'editorial_title'),
      (NEW.introduction_prompt_version_id, 'editorial_introduction'),
      (NEW.phase_prompt_version_id, 'editorial_phase'),
      (NEW.conclusion_prompt_version_id, 'editorial_conclusion')
    ) expected(version_id, prompt_key)
    JOIN editorial_prompt_versions version_record ON version_record.id = expected.version_id
    JOIN editorial_prompts prompt ON prompt.id = version_record.prompt_id
    WHERE prompt.prompt_key <> expected.prompt_key
      OR version_record.policy_id <> policy_record.policy_id
      OR version_record.policy_version <> policy_record.version
  ) THEN
    RAISE EXCEPTION 'Writer configuration binding prompt or policy lineage is inconsistent.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER enforce_editorial_writer_binding
BEFORE INSERT ON editorial_writer_configuration_bindings
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_writer_binding_lineage();

CREATE TRIGGER prevent_editorial_writer_configuration_bindings_mutation
BEFORE UPDATE OR DELETE ON editorial_writer_configuration_bindings
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_writer_configuration_mutation();
CREATE TRIGGER prevent_editorial_writer_binding_supersessions_mutation
BEFORE UPDATE OR DELETE ON editorial_writer_configuration_binding_supersessions
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_writer_configuration_mutation();
CREATE TRIGGER prevent_factory_editorial_generation_units_mutation
BEFORE UPDATE OR DELETE ON factory_editorial_generation_units
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_writer_configuration_mutation();
