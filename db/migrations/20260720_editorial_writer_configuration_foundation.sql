CREATE TABLE editorial_prompts (
  id UUID PRIMARY KEY,
  prompt_key TEXT NOT NULL UNIQUE CHECK (prompt_key IN (
    'editorial_title','editorial_introduction','editorial_phase','editorial_conclusion'
  )),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE editorial_prompt_versions (
  id UUID PRIMARY KEY,
  prompt_id UUID NOT NULL REFERENCES editorial_prompts(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  content TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 100000),
  content_fingerprint TEXT NOT NULL CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
  input_schema_version TEXT NOT NULL,
  output_schema_version TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prompt_id, version),
  UNIQUE (prompt_id, content_fingerprint)
);

CREATE TABLE editorial_prompt_supersessions (
  superseded_prompt_version_id UUID PRIMARY KEY REFERENCES editorial_prompt_versions(id) ON DELETE RESTRICT,
  successor_prompt_version_id UUID NOT NULL UNIQUE REFERENCES editorial_prompt_versions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (superseded_prompt_version_id <> successor_prompt_version_id)
);

CREATE TABLE editorial_writing_policies (
  id UUID PRIMARY KEY,
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  locale TEXT NOT NULL,
  tone TEXT NOT NULL,
  audience TEXT NOT NULL,
  reading_level TEXT NOT NULL,
  section_limits JSONB NOT NULL CHECK (jsonb_typeof(section_limits) = 'object'),
  quotation_policy TEXT NOT NULL,
  chronology_policy TEXT NOT NULL,
  causality_policy TEXT NOT NULL,
  citation_policy TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_id, version)
);

CREATE TABLE editorial_provider_configurations (
  id UUID PRIMARY KEY,
  provider_id TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  model TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  runtime_version TEXT NOT NULL,
  structured_output_version TEXT NOT NULL,
  timeout_ms INTEGER NOT NULL CHECK (timeout_ms BETWEEN 1 AND 600000),
  retry_limit INTEGER NOT NULL CHECK (retry_limit BETWEEN 0 AND 10),
  provenance_fingerprint TEXT NOT NULL UNIQUE CHECK (provenance_fingerprint ~ '^[a-f0-9]{64}$'),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_key, runtime_version)
);

CREATE INDEX idx_editorial_prompt_versions_exact ON editorial_prompt_versions(prompt_id, version);
CREATE INDEX idx_editorial_prompt_supersessions_successor ON editorial_prompt_supersessions(successor_prompt_version_id);
CREATE INDEX idx_editorial_writing_policies_exact ON editorial_writing_policies(policy_id, version);
CREATE INDEX idx_editorial_provider_configurations_exact ON editorial_provider_configurations(provider_key, runtime_version);

CREATE OR REPLACE FUNCTION prevent_editorial_writer_configuration_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Editorial Writer configuration is immutable Factory operational memory.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_editorial_prompts_mutation BEFORE UPDATE OR DELETE ON editorial_prompts
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_writer_configuration_mutation();
CREATE TRIGGER prevent_editorial_prompt_versions_mutation BEFORE UPDATE OR DELETE ON editorial_prompt_versions
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_writer_configuration_mutation();
CREATE TRIGGER prevent_editorial_prompt_supersessions_mutation BEFORE UPDATE OR DELETE ON editorial_prompt_supersessions
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_writer_configuration_mutation();
CREATE TRIGGER prevent_editorial_writing_policies_mutation BEFORE UPDATE OR DELETE ON editorial_writing_policies
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_writer_configuration_mutation();
CREATE TRIGGER prevent_editorial_provider_configurations_mutation BEFORE UPDATE OR DELETE ON editorial_provider_configurations
FOR EACH ROW EXECUTE FUNCTION prevent_editorial_writer_configuration_mutation();

CREATE OR REPLACE FUNCTION enforce_editorial_prompt_supersession_lineage()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM editorial_prompt_versions previous
    JOIN editorial_prompt_versions successor ON successor.id = NEW.successor_prompt_version_id
    WHERE previous.id = NEW.superseded_prompt_version_id
      AND previous.prompt_id = successor.prompt_id
      AND successor.version > previous.version
  ) THEN
    RAISE EXCEPTION 'Prompt supersession requires a later version of the same prompt.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER enforce_editorial_prompt_supersession
BEFORE INSERT ON editorial_prompt_supersessions
FOR EACH ROW EXECUTE FUNCTION enforce_editorial_prompt_supersession_lineage();
