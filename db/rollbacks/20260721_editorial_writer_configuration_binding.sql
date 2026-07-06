DROP TRIGGER IF EXISTS prevent_factory_editorial_generation_units_mutation ON factory_editorial_generation_units;
DROP TRIGGER IF EXISTS prevent_editorial_writer_binding_supersessions_mutation ON editorial_writer_configuration_binding_supersessions;
DROP TRIGGER IF EXISTS prevent_editorial_writer_configuration_bindings_mutation ON editorial_writer_configuration_bindings;
DROP TRIGGER IF EXISTS enforce_editorial_writer_binding ON editorial_writer_configuration_bindings;
DROP FUNCTION IF EXISTS enforce_editorial_writer_binding_lineage();
DROP TABLE IF EXISTS factory_editorial_generation_units;
DROP TABLE IF EXISTS editorial_writer_configuration_binding_supersessions;
DROP TABLE IF EXISTS editorial_writer_configuration_bindings;
ALTER TABLE editorial_provider_configurations
  DROP COLUMN IF EXISTS seed,
  DROP COLUMN IF EXISTS temperature,
  DROP COLUMN IF EXISTS model_version,
  DROP COLUMN IF EXISTS provider_version,
  DROP COLUMN IF EXISTS schema_version;
ALTER TABLE editorial_writing_policies
  DROP COLUMN IF EXISTS narrative_mode,
  DROP COLUMN IF EXISTS target_length,
  DROP COLUMN IF EXISTS schema_version;
ALTER TABLE editorial_prompt_versions
  DROP COLUMN IF EXISTS policy_version,
  DROP COLUMN IF EXISTS policy_id;
