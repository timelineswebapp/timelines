import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("db/migrations/20260717_editorial_composition_persistence.sql", "utf8");
const rollback = readFileSync("db/rollbacks/20260717_editorial_composition_persistence.sql", "utf8");
const repository = readFileSync("src/server/repositories/editorial-composition-repository.ts", "utf8");
const contracts = readFileSync("src/server/editorial-intelligence/editorial-composition-persistence-contracts.ts", "utf8");
const planner = readFileSync("src/server/editorial-intelligence/editorial-composition-planner.ts", "utf8");
const factoryContracts = readFileSync("src/server/factory/contracts.ts", "utf8");

test("persists EditorialComposition atomically with concurrent fingerprint serialization", () => {
  assert.match(repository, /withWriteTransaction\("persisting immutable EditorialComposition"/);
  assert.match(repository, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(repository, /getByFingerprint/);
  assert.match(migration, /UNIQUE \(editorial_timeline_candidate_id, planner_input_fingerprint\)/);
  assert.ok(repository.indexOf("pg_advisory_xact_lock") < repository.indexOf("INSERT INTO factory_objects"));
  assert.match(repository, /const existing = await findComposition\([\s\S]*if \(existing\) return existing;/);
});

test("registers exact immutable Factory ownership and deterministic identities", () => {
  assert.match(factoryContracts, /\| "editorial_composition"/);
  assert.match(migration, /'editorial_composition'/);
  assert.match(repository, /'editorial_composition', 'EditorialComposition'/);
  assert.match(repository, /authorityDecision: false/);
  assert.match(repository, /publicationReadinessDecision: false/);
  assert.match(migration, /prevent_editorial_composition_factory_object_update/);
  assert.match(migration, /planner_input_fingerprint TEXT NOT NULL CHECK/);
  assert.match(migration, /id UUID PRIMARY KEY/);
  assert.match(migration, /factory_object_id UUID NOT NULL UNIQUE/);
});

test("preserves exact predecessor and evidence-set lineage with delete restriction", () => {
  assert.match(migration, /factory_editorial_timeline_candidate_exact_lineage_unique/);
  assert.match(migration, /FOREIGN KEY \([\s\S]*editorial_timeline_candidate_id,[\s\S]*editorial_evidence_set_id,[\s\S]*editorial_timeline_candidate_fingerprint[\s\S]*ON DELETE RESTRICT/);
  for (const reference of [
    "factory_objects\\(id\\)",
    "factory_editorial_evidence_sets\\(id\\)",
    "evidence_records\\(id\\)"
  ]) {
    assert.match(migration, new RegExp(`REFERENCES ${reference}[\\s\\S]{0,80}ON DELETE RESTRICT`));
  }
});

test("persists references only and contains no content or causal grouping storage", () => {
  for (const forbidden of [
    "generated_prose",
    "summary",
    "milestone_title",
    "milestone_description",
    "causal_group"
  ]) {
    assert.equal(migration.toLowerCase().includes(forbidden), false);
    assert.equal(repository.toLowerCase().includes(forbidden), false);
  }
  assert.match(migration, /milestone_object_id UUID NOT NULL REFERENCES factory_objects/);
  assert.doesNotMatch(migration, /sort_year|sort_month|sort_day|chronology JSONB/);
});

test("enforces every selected milestone exactly once and rejects exclusions", () => {
  assert.match(migration, /PRIMARY KEY \(composition_id, milestone_object_id\)/);
  assert.match(migration, /UNIQUE \(composition_id, phase_key, position\)/);
  assert.match(migration, /membership_count <> selected_count/);
  assert.match(migration, /Every selected EI-002 milestone must appear exactly once/);
  assert.match(migration, /factory_editorial_timeline_candidate_exclusions/);
  assert.match(migration, /Excluded EI-002 milestones cannot appear/);
});

test("enforces contiguous phase and phase-milestone ordering with deferred checks", () => {
  assert.match(migration, /phase_min <> 1 OR phase_max <> phase_count/);
  assert.match(migration, /positions\.minimum <> 1 OR positions\.maximum <> positions\.count/);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
});

test("rejects mutation across every composition table", () => {
  for (const table of [
    "factory_editorial_compositions",
    "factory_editorial_composition_phases",
    "factory_editorial_composition_phase_milestones",
    "factory_editorial_composition_boundaries",
    "factory_editorial_composition_turning_points",
    "factory_editorial_composition_transitions",
    "factory_editorial_composition_continuity",
    "factory_editorial_composition_arcs",
    "factory_editorial_composition_arc_phases",
    "factory_editorial_composition_arc_milestones"
  ]) {
    assert.match(migration, new RegExp(`BEFORE UPDATE OR DELETE ON ${table}`));
  }
});

test("hydrates bounded relational reads by exact ID or exact fingerprint only", () => {
  assert.match(repository, /WHERE id = \$\{value\}[\s\S]*LIMIT 1/);
  assert.match(repository, /planner_input_fingerprint = \$\{value\}[\s\S]*LIMIT 1/);
  assert.match(repository, /editorial_timeline_candidate_id = \$\{editorialTimelineCandidateId!\}/);
  for (const bound of ["LIMIT 2", "LIMIT 199", "LIMIT 200", "LIMIT 10000", "LIMIT 40000"]) {
    assert.match(repository, new RegExp(bound));
  }
  assert.doesNotMatch(repository, /ORDER BY created_at DESC/);
  assert.doesNotMatch(repository, /subject.*LIKE|ILIKE/i);
});

test("repository remains separate from planner and business logic", () => {
  assert.doesNotMatch(repository, /editorial-composition-planner/);
  assert.doesNotMatch(repository, /planEditorialComposition/);
  assert.doesNotMatch(repository, /historicalSignificance|narrativeContribution|score/);
  assert.doesNotMatch(planner, /repositories|db\/client|factory_objects/);
  assert.match(contracts, /create\(input: PersistEditorialCompositionInput\)/);
  assert.match(contracts, /getById\(compositionId: string\)/);
  assert.match(contracts, /getByFingerprint/);
});

test("rollback removes only Slice 2 schema and restores the prior object registry", () => {
  assert.match(rollback, /DROP TABLE IF EXISTS factory_editorial_composition_arc_milestones/);
  assert.match(rollback, /DROP TABLE IF EXISTS factory_editorial_compositions/);
  assert.match(rollback, /DROP CONSTRAINT IF EXISTS factory_editorial_timeline_candidate_exact_lineage_unique/);
  assert.doesNotMatch(rollback, /DELETE FROM factory_objects/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS factory_objects/);
  assert.doesNotMatch(rollback, /'editorial_composition'/);
  assert.match(rollback, /'editorial_timeline_candidate'/);
});
