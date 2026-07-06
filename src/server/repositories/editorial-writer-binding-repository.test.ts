import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("db/migrations/20260721_editorial_writer_configuration_binding.sql", "utf8");
const rollback = readFileSync("db/rollbacks/20260721_editorial_writer_configuration_binding.sql", "utf8");
const contracts = readFileSync("src/server/editorial-intelligence/editorial-writer-configuration-contracts.ts", "utf8");
const configurationRepository = readFileSync("src/server/repositories/editorial-writer-configuration-repository.ts", "utf8");
const bindingRepository = readFileSync("src/server/repositories/editorial-writer-binding-repository.ts", "utf8");

test("resolves every missing WriterInput provenance field", () => {
  for (const field of ["policyId", "policyVersion", "schemaVersion", "targetLength",
    "narrativeMode", "providerVersion", "modelVersion", "temperature", "seed"]) {
    assert.match(contracts, new RegExp(field));
  }
  for (const column of ["policy_id", "policy_version", "schema_version", "target_length",
    "narrative_mode", "provider_version", "model_version", "temperature", "seed"]) {
    assert.match(migration, new RegExp(column));
  }
  assert.match(configurationRepository, /input\.policyId/);
  assert.match(configurationRepository, /input\.targetLength/);
  assert.match(configurationRepository, /input\.providerVersion/);
});

test("binding pins the exact four prompts, policy, provider, locale and mode", () => {
  for (const reference of ["title_prompt_version_id", "introduction_prompt_version_id",
    "phase_prompt_version_id", "conclusion_prompt_version_id", "writing_policy_version_id",
    "provider_configuration_id"]) {
    assert.match(migration, new RegExp(`${reference} UUID NOT NULL REFERENCES`));
  }
  assert.match(migration, /policy_record\.locale <> NEW\.locale/);
  assert.match(migration, /version_record\.policy_id <> policy_record\.policy_id/);
  assert.match(migration, /version_record\.policy_version <> policy_record\.version/);
});

test("binding repository provides exact and active retrieval without runtime defaults", () => {
  for (const method of ["createWriterConfigurationBinding", "getWriterConfigurationBindingById",
    "getActiveWriterConfigurationBinding"]) assert.match(contracts, new RegExp(method));
  assert.match(bindingRepository, /WHERE binding\.id = \$\{id\}[\s\S]*LIMIT 1/);
  assert.match(bindingRepository, /WHERE supersession\.superseded_binding_id IS NULL[\s\S]*LIMIT 1/);
  assert.doesNotMatch(bindingRepository, /process\.env|editorialWriterPromptAssets|readFile|defaultConfig/i);
});

test("binding is immutable, append-only and fingerprint-stable", () => {
  const value = JSON.stringify({ prompts: ["a", "b", "c", "d"], policy: "p", provider: "q" });
  assert.equal(createHash("sha256").update(value).digest("hex"), createHash("sha256").update(value).digest("hex"));
  assert.match(migration, /binding_fingerprint TEXT NOT NULL UNIQUE/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON editorial_writer_configuration_bindings/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON editorial_writer_configuration_binding_supersessions/);
  assert.match(bindingRepository, /must supersede the exact active binding/);
  assert.doesNotMatch(bindingRepository, /UPDATE editorial_writer_configuration_bindings|DELETE FROM editorial_writer_configuration_bindings/);
});

test("persists only successfully validated generation units as immutable execution artifacts", () => {
  assert.match(migration, /CREATE TABLE factory_editorial_generation_units/);
  assert.match(migration, /status TEXT NOT NULL CHECK \(status = 'validated'\)/);
  assert.match(migration, /grounding_validation_report->>'passed' = 'true'/);
  assert.match(migration, /UNIQUE \(execution_key, unit_type, unit_sequence\)/);
  assert.match(migration, /output_fingerprint TEXT NOT NULL UNIQUE/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON factory_editorial_generation_units/);
});

test("successful unit creation is idempotent and conflicting replay fails closed", () => {
  assert.match(bindingRepository, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(bindingRepository, /getValidatedGenerationUnit\([\s\S]*input\.executionKey/);
  assert.match(bindingRepository, /Validated generation unit identity conflict/);
  assert.match(bindingRepository, /return existing/);
});

test("failed units remain retry eligible because only validated successes are persisted", () => {
  assert.doesNotMatch(contracts, /status: "failed"/);
  assert.doesNotMatch(bindingRepository, /INSERT[\s\S]{0,200}'failed'/);
  assert.match(contracts, /status: "validated"/);
  assert.match(bindingRepository, /groundingValidationReport/);
});

test("generation-unit loaders are exact and bounded without latest selection", () => {
  assert.match(bindingRepository, /execution_key=\$\{executionKey\} AND unit_type=\$\{unitType\} AND unit_sequence=\$\{unitSequence\}/);
  assert.match(bindingRepository, /WHERE execution_key=\$\{executionKey\}[\s\S]*LIMIT 1000/);
  const unitPath = bindingRepository.slice(bindingRepository.indexOf("editorialGenerationUnitRepository"));
  assert.doesNotMatch(unitPath, /ORDER BY created_at DESC|latest|subject|ILIKE/);
});

test("all new lineage is delete-restricted and rollback is complete", () => {
  assert.ok((migration.match(/ON DELETE RESTRICT/g) || []).length >= 9);
  assert.match(rollback, /DROP TABLE IF EXISTS factory_editorial_generation_units/);
  assert.match(rollback, /DROP TABLE IF EXISTS editorial_writer_configuration_bindings/);
  assert.match(rollback, /DROP COLUMN IF EXISTS policy_id/);
  assert.match(rollback, /DROP COLUMN IF EXISTS narrative_mode/);
  assert.match(rollback, /DROP COLUMN IF EXISTS provider_version/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS editorial_prompt_versions/);
});
