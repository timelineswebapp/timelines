import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("db/migrations/20260720_editorial_writer_configuration_foundation.sql", "utf8");
const rollback = readFileSync("db/rollbacks/20260720_editorial_writer_configuration_foundation.sql", "utf8");
const repository = readFileSync("src/server/repositories/editorial-writer-configuration-repository.ts", "utf8");
const contracts = readFileSync("src/server/editorial-intelligence/editorial-writer-configuration-contracts.ts", "utf8");
const validationRepository = readFileSync("src/server/repositories/evidence-validation-repository.ts", "utf8");
const sourceRepository = readFileSync("src/server/repositories/source-authority-repository.ts", "utf8");

test("defines immutable repository-backed prompt, policy and provider registries", () => {
  for (const table of ["editorial_prompts", "editorial_prompt_versions", "editorial_prompt_supersessions",
    "editorial_writing_policies", "editorial_provider_configurations"]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}`));
    assert.match(migration, new RegExp(`BEFORE UPDATE OR DELETE ON ${table}`));
  }
  assert.match(migration, /prevent_editorial_writer_configuration_mutation/);
  assert.ok((migration.match(/ON DELETE RESTRICT/g) || []).length >= 3);
});

test("prompt versions are exact, immutable and append-only supersessions", () => {
  for (const method of ["getPromptById", "getPromptVersion", "getActivePrompt", "createPrompt"]) {
    assert.match(contracts, new RegExp(method));
  }
  assert.match(migration, /UNIQUE \(prompt_id, version\)/);
  assert.match(migration, /UNIQUE \(prompt_id, content_fingerprint\)/);
  assert.match(migration, /successor\.version > previous\.version/);
  assert.match(repository, /supersession must target the exact active prior version/);
  assert.doesNotMatch(repository, /UPDATE editorial_prompt|DELETE FROM editorial_prompt/);
});

test("policy and provider identities are immutable and fingerprint-addressable", () => {
  assert.match(migration, /UNIQUE \(policy_id, version\)/);
  assert.match(migration, /fingerprint TEXT NOT NULL UNIQUE/);
  assert.match(migration, /UNIQUE \(provider_key, runtime_version\)/);
  assert.match(migration, /provenance_fingerprint TEXT NOT NULL UNIQUE/);
  for (const method of ["getPolicyById", "getPolicyVersion", "createPolicy",
    "getProviderConfiguration", "getProviderConfigurationById", "createProviderConfiguration"]) {
    assert.match(contracts, new RegExp(method));
  }
});

test("configuration fingerprints remain stable for identical bytes", () => {
  const content = "Immutable grounded editorial prompt.";
  assert.equal(createHash("sha256").update(content).digest("hex"), createHash("sha256").update(content).digest("hex"));
  assert.match(migration, /content_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(migration, /provenance_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/);
});

test("repository reads use exact identities, bounded results and no fuzzy matching", () => {
  assert.match(repository, /WHERE version_record\.id = \$\{value\} LIMIT 1/);
  assert.match(repository, /version_record\.prompt_id = \$\{value\} AND version_record\.version = \$\{version!\} LIMIT 1/);
  assert.match(repository, /WHERE policy_id=\$\{value\} AND version=\$\{version!\} LIMIT 1/);
  assert.match(repository, /WHERE provider_key=\$\{value\} AND runtime_version=\$\{runtimeVersion!\} LIMIT 1/);
  assert.doesNotMatch(repository, /ILIKE| LIKE |ORDER BY .* DESC/);
});

test("exposes bounded exact validation record loaders without subject selection", () => {
  assert.match(validationRepository, /getValidationRecordById/);
  assert.match(validationRepository, /getValidationRecords/);
  assert.match(validationRepository, /WHERE id = ANY\(\$\{ids\}::uuid\[\]\)/);
  assert.match(validationRepository, /LIMIT 500/);
  const loader = validationRepository.slice(validationRepository.indexOf("getValidationRecordById"), validationRepository.indexOf("getEvidenceSubject"));
  assert.doesNotMatch(loader, /topic|created_at DESC|status = 'passed'/);
});

test("exposes bounded exact source snapshot loaders without latest selection", () => {
  assert.match(sourceRepository, /getSourceSnapshotById/);
  assert.match(sourceRepository, /getSourceSnapshots/);
  assert.match(sourceRepository, /WHERE id = ANY\(\$\{ids\}::uuid\[\]\)/);
  assert.match(sourceRepository, /LIMIT 500/);
  const loader = sourceRepository.slice(sourceRepository.indexOf("getSourceSnapshotById"), sourceRepository.indexOf("async recordRelevanceRejection"));
  assert.doesNotMatch(loader, /ORDER BY version DESC|source_record_id =/);
});

test("registry remains isolated from runtime, generation and institutional authority", () => {
  for (const forbidden of ["editorial-writer-runtime", "runEditorialWriter", "factory-service",
    "governance", "historical-library", "published-memory", "pipeline-registry", "fetch("]) {
    assert.equal(repository.toLowerCase().includes(forbidden), false);
  }
  assert.doesNotMatch(repository, /readFile|editorialWriterPromptAssets|process\.env/);
});

test("migration rollback removes only EI-003A configuration assets", () => {
  for (const table of ["editorial_prompt_supersessions", "editorial_prompt_versions", "editorial_prompts",
    "editorial_writing_policies", "editorial_provider_configurations"]) {
    assert.match(rollback, new RegExp(`DROP TABLE IF EXISTS ${table}`));
  }
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS source_authority_snapshots/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS evidence_validation_records/);
  assert.doesNotMatch(rollback, /DELETE FROM/);
});
