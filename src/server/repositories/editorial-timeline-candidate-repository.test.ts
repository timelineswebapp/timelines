import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("db/migrations/20260715_editorial_timeline_candidate_persistence.sql", "utf8");
const rollback = readFileSync("db/rollbacks/20260715_editorial_timeline_candidate_persistence.sql", "utf8");
const repository = readFileSync("src/server/repositories/editorial-timeline-candidate-repository.ts", "utf8");
const compiler = readFileSync("src/server/editorial-intelligence/timeline-compiler.ts", "utf8");
const pipelineRegistry = readFileSync("src/server/factory/pipeline-registry.ts", "utf8");
const factoryService = readFileSync("src/server/services/factory-service.ts", "utf8");

test("persists EditorialTimelineCandidate atomically with serialized fingerprint idempotency", () => {
  assert.match(repository, /withWriteTransaction\("persisting immutable EditorialTimelineCandidate"/);
  assert.match(repository, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(repository, /getByFingerprint/);
  assert.match(migration, /UNIQUE \(editorial_evidence_set_id, compiler_input_fingerprint\)/);
  assert.ok(repository.indexOf("pg_advisory_xact_lock") < repository.indexOf("INSERT INTO factory_objects"));
});

test("registers an immutable non-authoritative Factory Production Memory object", () => {
  assert.match(migration, /'editorial_timeline_candidate'/);
  assert.match(repository, /'editorial_timeline_candidate'/);
  assert.match(repository, /authorityDecision: false/);
  assert.match(repository, /publicationReadinessDecision: false/);
  assert.match(migration, /prevent_editorial_timeline_factory_object_update/);
  assert.match(factoryService, /EDITORIAL_TIMELINE_CANDIDATE_NOT_PACKAGEABLE/);
  assert.match(pipelineRegistry, /"editorial_timeline_compiler", "validation_worker", "package_assembly_worker"/);
});

test("preserves foreign-key lineage with delete restriction", () => {
  for (const reference of [
    "factory_objects\\(id\\)",
    "factory_editorial_evidence_sets\\(id\\)",
    "evidence_records\\(id\\)",
    "evidence_validation_records\\(id, evidence_record_id\\)"
  ]) {
    assert.match(migration, new RegExp(`REFERENCES ${reference}[\\s\\S]{0,80}ON DELETE RESTRICT`));
  }
  assert.match(migration, /FOREIGN KEY \(candidate_id, milestone_object_id\)/);
  assert.match(migration, /REFERENCES factory_editorial_timeline_candidate_milestones/);
});

test("rejects mutation, duplicate persistence, and invalid sequence structure", () => {
  for (const table of [
    "factory_editorial_timeline_candidates",
    "factory_editorial_timeline_candidate_milestones",
    "factory_editorial_timeline_candidate_evidence",
    "factory_editorial_timeline_candidate_exclusions"
  ]) {
    assert.match(migration, new RegExp(`BEFORE UPDATE OR DELETE ON ${table}`));
  }
  assert.match(migration, /PRIMARY KEY \(candidate_id, milestone_object_id\)/);
  assert.match(migration, /UNIQUE \(candidate_id, sequence\)/);
  assert.match(migration, /sequence_min <> 1 OR sequence_max <> sequence_count/);
  assert.match(migration, /excluded_milestone_object_id <> canonical_milestone_object_id/);
});

test("uses bounded exact-ID and fingerprint reads without compiler or service logic", () => {
  assert.match(repository, /WHERE id = \$\{value\}[\s\S]*LIMIT 1/);
  assert.match(repository, /compiler_input_fingerprint = \$\{value\}[\s\S]*LIMIT 1/);
  assert.match(repository, /LIMIT 200/);
  assert.match(repository, /LIMIT 10000/);
  assert.doesNotMatch(repository, /timeline-compiler"/);
  assert.doesNotMatch(repository, /compileEditorialTimeline/);
  assert.doesNotMatch(compiler, /repositories|db\/client|factory_objects/);
});

test("rollback removes Slice 2 persistence without deleting Factory history", () => {
  assert.match(rollback, /DROP TABLE IF EXISTS factory_editorial_timeline_candidate_exclusions/);
  assert.match(rollback, /DROP TABLE IF EXISTS factory_editorial_timeline_candidate_evidence/);
  assert.match(rollback, /DROP TABLE IF EXISTS factory_editorial_timeline_candidate_milestones/);
  assert.match(rollback, /DROP TABLE IF EXISTS factory_editorial_timeline_candidates/);
  assert.doesNotMatch(rollback, /DELETE FROM factory_objects/);
  assert.doesNotMatch(rollback, /DROP TABLE IF EXISTS factory_objects/);
});
