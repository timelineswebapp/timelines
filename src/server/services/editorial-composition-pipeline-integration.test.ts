import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registry = readFileSync("src/server/factory/pipeline-registry.ts", "utf8");
const service = readFileSync("src/server/services/factory-service.ts", "utf8");
const adapter = readFileSync("src/server/editorial-intelligence/editorial-composition-adapter.ts", "utf8");
const repository = readFileSync("src/server/repositories/editorial-composition-repository.ts", "utf8");

test("composition checkpoint is exactly between compiler and validation", () => {
  assert.match(registry, /steps: \["editorial_timeline_compiler", "editorial_composition_planner", "editorial_writer", "validation_worker", "package_assembly_worker"\]/);
  assert.equal((registry.match(/"editorial_composition_planner"/g) || []).length, 1);
});

test("adapter loads exact candidate and evidence-set lineage without latest lookup", () => {
  assert.match(adapter, /editorialTimelineCandidateRepository\.getById\(input\.editorialTimelineCandidateId\)/);
  assert.match(adapter, /editorialEvidenceRepository\.getById\(input\.editorialEvidenceSetId\)/);
  assert.match(adapter, /planEditorialComposition/);
  assert.match(adapter, /editorialCompositionRepository\.create/);
  assert.match(adapter, /EDITORIAL_COMPOSITION_CANDIDATE_NOT_FOUND/);
  assert.match(adapter, /EDITORIAL_COMPOSITION_EVIDENCE_LINEAGE_MISMATCH/);
  assert.match(adapter, /EDITORIAL_COMPOSITION_CANDIDATE_FINGERPRINT_MISMATCH/);
  assert.doesNotMatch(adapter, /latest|subject.*lookup|ORDER BY created_at/i);
});

test("candidate mismatch and fingerprint mismatch fail closed", () => {
  assert.match(adapter, /persistedCandidate\.editorialEvidenceSetId !== editorialEvidenceSet\.editorialEvidenceSetId/);
  assert.match(adapter, /persistedCandidate\.compilerInputFingerprint !== input\.expectedTimelineCandidate\.compilerInputFingerprint/);
  assert.match(adapter, /EDITORIAL_COMPOSITION_CANDIDATE_MEMBERSHIP_MISMATCH/);
});

test("composition, object, artifact, step, audit, and run references commit atomically", () => {
  const transactionStart = service.indexOf('withWriteTransaction("committing EditorialComposition planner checkpoint"');
  const transactionEnd = service.indexOf("continue;", transactionStart);
  const block = service.slice(transactionStart, transactionEnd);
  assert.ok(transactionStart > 0);
  assert.match(block, /prepareAndPersistEditorialComposition/);
  assert.match(block, /factoryRepository\.createArtifact/);
  assert.match(block, /factoryRepository\.transitionPipelineStep/);
  assert.match(block, /factoryRepository\.createRuntimeAuditRecord/);
  assert.match(block, /factoryRepository\.transitionPipelineRun/);
  assert.match(block, /editorial_composition_planning/);
});

test("resume resolves exact fingerprint output and rejects duplicate or unrelated artifacts", () => {
  assert.match(service, /matchingCompositionArtifacts\.length > 1/);
  assert.match(service, /PUBLICATION_COMPOSITION_ARTIFACT_AMBIGUOUS/);
  assert.match(service, /editorialCompositionRepository\.getByFingerprint/);
  assert.match(service, /PUBLICATION_COMPOSITION_CHECKPOINT_INCOMPLETE/);
  assert.match(service, /PUBLICATION_COMPOSITION_ARTIFACT_UNRELATED/);
  assert.match(service, /PUBLICATION_COMPOSITION_FINGERPRINT_STALE/);
  assert.match(service, /buildEditorialCompositionFromExactLineage/);
  assert.match(repository, /pg_advisory_xact_lock/);
  assert.match(repository, /if \(existing\) return existing/);
});

test("validation and package assembly require both editorial checkpoints", () => {
  assert.match(service, /assertEditorialCompositionCheckpoint/);
  assert.match(service, /assertEditorialCompilerCheckpoint\(input\)/);
  assert.match(service, /PUBLICATION_COMPOSITION_CHECKPOINT_REQUIRED/);
  assert.match(service, /artifactRefs\.includes\(input\.compositionArtifactId\)/);
  assert.match(service, /Package milestone references must equal EditorialComposition membership/);
});

test("composition artifact ownership and versions remain pinned", () => {
  assert.match(service, /existingCompositionArtifact\.factoryObjectId !== persistedComposition\.factoryObjectId/);
  assert.match(service, /plannerVersion: persistedEditorialComposition\.plannerVersion/);
  assert.match(service, /structureAlgorithmVersion: persistedEditorialComposition\.structureAlgorithmVersion/);
  assert.match(service, /plannerInputFingerprint: persistedEditorialComposition\.plannerInputFingerprint/);
});

test("Governance authority excludes both editorial Factory objects", () => {
  assert.match(service, /object\.objectType === "editorial_timeline_candidate"/);
  assert.match(service, /object\.objectType === "editorial_composition"/);
  assert.match(service, /EDITORIAL_COMPOSITION_NOT_PACKAGEABLE/);
  assert.match(service, /PUBLICATION_COMPOSITION_AUTHORITY_BOUNDARY_VIOLATION/);
});

test("integration remains inside Factory without writing or downstream institutions", () => {
  for (const forbidden of [
    "historicalLibraryService",
    "publishedMemoryProjectionService",
    "editorial writer",
    "generated prose",
    "seo"
  ]) {
    assert.equal((adapter + registry).toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});
