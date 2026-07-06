import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registry = readFileSync("src/server/factory/pipeline-registry.ts", "utf8");
const service = readFileSync("src/server/services/factory-service.ts", "utf8");
const repository = readFileSync("src/server/repositories/factory-repository.ts", "utf8");

test("compiler and composition are ordered before validation and assembly", () => {
  assert.match(registry, /steps: \["editorial_timeline_compiler", "editorial_composition_planner", "validation_worker", "package_assembly_worker"\]/);
  assert.match(service, /deterministicPublicationSteps = new Set\(\["editorial_timeline_compiler", "editorial_composition_planner"\]\)/);
  assert.doesNotMatch(service, /deterministicResearchSteps = new Set\(\[[\s\S]{0,200}"editorial_timeline_compiler"/);
});

test("pins exact predecessors and prevents latest-by-subject drift during resume", () => {
  assert.match(service, /pinnedPublicationLineage\(existingRun\)/);
  assert.match(service, /factoryRepository\.getPipelineRun\(pinned\.researchPipelineRunId\)/);
  assert.match(service, /factoryRepository\.getPipelineRun\(pinned\.extractionPipelineRunId\)/);
  assert.match(service, /PUBLICATION_COMPILER_FINGERPRINT_STALE/);
  assert.match(repository, /input->>'workflowId' = \$\{workflowId\}/);
});

test("fails closed for missing EI-001, extraction, stale, and unrelated lineage", () => {
  for (const code of [
    "PUBLICATION_EDITORIAL_EVIDENCE_LINEAGE_REQUIRED",
    "PUBLICATION_EXTRACTION_PREDECESSOR_REQUIRED",
    "PUBLICATION_COMPILER_FINGERPRINT_STALE",
    "EDITORIAL_COMPILER_UNRELATED_MILESTONE",
    "PUBLICATION_COMPILER_MILESTONE_LINEAGE_INCOMPLETE"
  ]) assert.match(service + readFileSync("src/server/editorial-intelligence/timeline-compiler-adapter.ts", "utf8"), new RegExp(code));
});

test("candidate, artifact, step, audit, and run checkpoint share one transaction", () => {
  const transactionStart = service.indexOf('withWriteTransaction("committing EditorialTimelineCandidate compiler checkpoint"');
  const transactionEnd = service.indexOf("continue;", transactionStart);
  const block = service.slice(transactionStart, transactionEnd);
  assert.ok(transactionStart > 0);
  assert.match(block, /editorialTimelineCandidateRepository\.create/);
  assert.match(block, /factoryRepository\.createArtifact/);
  assert.match(block, /factoryRepository\.transitionPipelineStep/);
  assert.match(block, /factoryRepository\.createRuntimeAuditRecord/);
  assert.match(block, /factoryRepository\.transitionPipelineRun/);
});

test("resume retrieves fingerprint-idempotent output and package lineage excludes candidate authority", () => {
  assert.match(service, /editorialTimelineCandidateRepository\.getByFingerprint/);
  assert.match(service, /EDITORIAL_TIMELINE_CANDIDATE_NOT_PACKAGEABLE/);
  assert.match(service, /PUBLICATION_COMPILER_AUTHORITY_BOUNDARY_VIOLATION/);
  assert.match(service, /selectedFactoryObjectRefs/);
  assert.match(service, /artifactRefs\.includes\(input\.compilerArtifactId\)/);
});

test("integration remains Factory-only", () => {
  assert.doesNotMatch(service, /historicalLibraryService|publishedMemoryProjectionService/);
  assert.doesNotMatch(service, /app\/|components\//);
});
