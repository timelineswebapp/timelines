import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("db/migrations/20260719_editorial_narrative_persistence.sql", "utf8");
const rollback = readFileSync("db/rollbacks/20260719_editorial_narrative_persistence.sql", "utf8");
const repository = readFileSync("src/server/repositories/editorial-narrative-repository.ts", "utf8");
const contracts = readFileSync("src/server/editorial-intelligence/editorial-narrative-persistence-contracts.ts", "utf8");
const factory = readFileSync("src/server/factory/contracts.ts", "utf8");
const service = readFileSync("src/server/services/factory-service.ts", "utf8");

test("persists the narrative and Factory identity atomically under a compound advisory lock", () => {
  assert.match(repository, /withWriteTransaction\("persisting immutable EditorialNarrative"/);
  assert.match(repository, /pg_advisory_xact_lock\(hashtextextended/);
  assert.ok(repository.indexOf("pg_advisory_xact_lock") < repository.indexOf("INSERT INTO factory_objects"));
  for (const relation of ["factory_objects", "factory_editorial_narratives", "factory_editorial_narrative_sections",
    "factory_editorial_narrative_paragraphs", "factory_editorial_narrative_sentences",
    "factory_editorial_narrative_revisions"]) assert.match(repository, new RegExp(`INSERT INTO ${relation}`));
});

test("provides exact bounded identity retrieval without subject or latest lookup", () => {
  for (const method of ["getById", "getByExecutionKey", "getByOutputFingerprint"]) assert.match(contracts, new RegExp(method));
  assert.match(repository, /WHERE \$\{sql\(column\)\} = \$\{value\} LIMIT 1/);
  assert.doesNotMatch(repository, /ORDER BY created_at DESC|ILIKE|LIKE/);
  for (const bound of ["LIMIT 20", "LIMIT 202", "LIMIT 10000", "LIMIT 1000000"]) {
    assert.match(repository, new RegExp(bound));
  }
});

test("reuses exact duplicate persistence and rejects split execution/output identities", () => {
  assert.match(migration, /execution_key TEXT NOT NULL UNIQUE/);
  assert.match(migration, /output_fingerprint TEXT NOT NULL UNIQUE/);
  assert.match(repository, /if \(byExecution \|\| byOutput\)/);
  assert.match(repository, /EditorialNarrative identity conflict/);
  assert.match(repository, /return \(byExecution \|\| byOutput\)!/);
});

test("normalizes narrative structure, provenance, claims, milestones, citations and revisions", () => {
  for (const relation of [
    "factory_editorial_narrative_prompt_refs", "factory_editorial_narrative_provenance",
    "factory_editorial_narrative_sections", "factory_editorial_narrative_paragraphs",
    "factory_editorial_narrative_sentences", "factory_editorial_narrative_sentence_claims",
    "factory_editorial_narrative_sentence_milestones", "factory_editorial_narrative_citations",
    "factory_editorial_narrative_citation_sentences", "factory_editorial_narrative_citation_evidence",
    "factory_editorial_narrative_revisions"
  ]) assert.match(migration, new RegExp(`CREATE TABLE ${relation}`));
  assert.doesNotMatch(migration, /narrative_structure JSONB|sections JSONB|paragraphs JSONB|sentences JSONB/);
  assert.match(migration, /diagnostics JSONB NOT NULL[\s\S]*jsonb_array_length\(diagnostics\) <= 1000/);
});

test("pins exact predecessor, evidence, prompt, policy, provider, writer and algorithm provenance", () => {
  assert.match(migration, /factory_editorial_composition_exact_lineage_unique/);
  assert.match(migration, /FOREIGN KEY \(editorial_composition_id, editorial_timeline_candidate_id,[\s\S]*editorial_evidence_set_id, composition_fingerprint\)/);
  for (const field of ["writer_version", "generation_algorithm_version", "writer_input_fingerprint",
    "output_fingerprint", "execution_key", "writing_policy", "provider_provenance", "prompt_fingerprint"]) {
    assert.match(migration, new RegExp(field));
  }
});

test("enforces ordering, coverage, exclusions, evidence membership and referential integrity", () => {
  assert.match(migration, /section ordering must be contiguous/);
  assert.match(migration, /paragraph ordering must be contiguous/);
  assert.match(migration, /sentence ordering must be contiguous/);
  assert.match(migration, /Every selected milestone must be covered/);
  assert.match(migration, /Excluded milestones cannot be referenced/);
  assert.match(migration, /factory_editorial_evidence_set_inputs/);
  assert.match(migration, /Narrative claims must belong to the pinned EditorialEvidenceSet/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
  assert.ok((migration.match(/ON DELETE RESTRICT/g) || []).length >= 15);
});

test("registers immutable non-authoritative Factory Production Memory", () => {
  assert.match(factory, /\| "editorial_narrative"/);
  assert.match(migration, /'editorial_narrative'/);
  assert.match(repository, /authorityDecision:false,publicationReadinessDecision:false/);
  assert.match(migration, /prevent_editorial_narrative_factory_object_update/);
  assert.match(service, /EDITORIAL_NARRATIVE_NOT_PACKAGEABLE/);
  assert.match(service, /EditorialNarrative is Factory Production Memory and cannot become Governance canonical authority/);
});

test("preserves revisions instead of updating or overwriting narratives", () => {
  assert.match(migration, /supersedes_narrative_id UUID REFERENCES factory_editorial_narratives\(id\) ON DELETE RESTRICT/);
  assert.match(contracts, /supersedesNarrativeId: string \| null/);
  assert.doesNotMatch(repository, /UPDATE factory_editorial_narratives|DELETE FROM factory_editorial_narratives/);
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
});

test("repository contains no generation, validation, planner, pipeline or institutional access", () => {
  for (const forbidden of ["editorial-writer-runtime", "grounding-validator", "composition-planner",
    "pipeline-registry", "governance", "historical-library", "published-memory"]) {
    assert.equal(repository.toLowerCase().includes(forbidden), false);
  }
});

test("supports the declared maximum shape with bounded batch inserts and hydration", () => {
  assert.match(migration, /sequence BETWEEN 1 AND 202/);
  assert.match(migration, /sequence BETWEEN 1 AND 1000/);
  assert.match(repository, /jsonb_to_recordset/g);
  assert.match(repository, /LIMIT 1000000/);
});

test("rollback removes only Slice 3 persistence and restores Factory registration", () => {
  assert.match(rollback, /DROP TABLE IF EXISTS factory_editorial_narratives/);
  assert.match(rollback, /DROP CONSTRAINT IF EXISTS factory_editorial_composition_exact_lineage_unique/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS factory_objects/);
  assert.doesNotMatch(rollback, /DELETE FROM/);
  assert.match(rollback, /'editorial_composition'/);
  assert.doesNotMatch(rollback, /'editorial_narrative'/);
});
