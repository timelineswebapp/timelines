import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registry = readFileSync("src/server/factory/pipeline-registry.ts", "utf8");
const service = readFileSync("src/server/services/factory-service.ts", "utf8");
const adapter = readFileSync("src/server/editorial-intelligence/editorial-writer-adapter.ts", "utf8");
const runtime = readFileSync("src/server/editorial-intelligence/editorial-writer-runtime.ts", "utf8");
const narrativeRepository = readFileSync("src/server/repositories/editorial-narrative-repository.ts", "utf8");
const unitRepository = readFileSync("src/server/repositories/editorial-writer-binding-repository.ts", "utf8");

test("Editorial Writer is the only checkpoint between composition and validation", () => {
  assert.match(registry, /steps: \["editorial_timeline_compiler", "editorial_composition_planner", "editorial_writer", "validation_worker", "package_assembly_worker"\]/);
  assert.match(service, /deterministicPublicationSteps = new Set\(\["editorial_timeline_compiler", "editorial_composition_planner", "editorial_writer"\]\)/);
});

test("adapter resolves every input through exact immutable repository identities", () => {
  for (const method of ["getById(input.editorialCompositionId)", "getById(input.editorialTimelineCandidateId)",
    "getById(input.editorialEvidenceSetId)", "getWriterConfigurationBindingById(input.writerConfigurationBindingId)",
    "getPromptById", "getPolicyById", "getProviderConfigurationById", "getValidationRecords",
    "getEvidenceSubject", "getSourceSnapshots"]) assert.ok(adapter.includes(method), method);
  assert.doesNotMatch(adapter, /getActive|Latest|latest|listValidatedEvidence|process\.env/);
});

test("writer builds certified input, invokes the existing runtime, and persists through repositories", () => {
  assert.match(adapter, /buildEditorialNarrativeWriterInput/);
  assert.match(adapter, /runEditorialWriter/);
  assert.match(adapter, /editorialNarrativeRepository\.create/);
  assert.match(adapter, /editorialGenerationUnitRepository\.createValidatedGenerationUnit/);
  assert.doesNotMatch(adapter, /INSERT INTO|UPDATE |DELETE FROM/);
});

test("completed narrative resume performs no generation", () => {
  const lookup = adapter.indexOf("getByExecutionKey(input.executionKey)");
  const runtimeCall = adapter.indexOf("runEditorialWriter(writerInput");
  assert.ok(lookup > 0 && lookup < runtimeCall);
  assert.match(adapter, /if \(existingNarrative\)[\s\S]*return \{ narrative: existingNarrative, reusedNarrative: true, writerInput \}/);
});

test("runtime reuses validated units and generates only missing units", () => {
  assert.match(runtime, /loadValidatedUnit/);
  assert.match(runtime, /if \(reused\)[\s\S]*successful\.push\(reused\.validated\)[\s\S]*continue/);
  assert.match(runtime, /persistValidatedUnit/);
  assert.match(adapter, /getValidatedGenerationUnit/);
  assert.match(unitRepository, /Validated generation unit identity conflict/);
});

test("resume pins exact binding and rejects client-supplied writer lineage", () => {
  assert.match(service, /writerConfigurationBindingId: publicationLineage\.writerConfigurationBindingId/);
  assert.match(service, /pinned\.writerConfigurationBindingId/);
  for (const field of ["writerConfigurationBindingId", "promptVersionIds", "writingPolicyVersionId",
    "providerConfigurationId", "editorialNarrativeId"]) assert.match(service, new RegExp(`"${field}"`));
  assert.match(service, /FACTORY_LINEAGE_INPUT_FORBIDDEN/);
});

test("writer checkpoint persistence, artifact, step, audit and run references are atomic", () => {
  assert.match(service, /withWriteTransaction\("committing Editorial Writer checkpoint"/);
  const start = service.indexOf('withWriteTransaction("committing Editorial Writer checkpoint"');
  const end = service.indexOf('stage: "editorial_writing"', start);
  const checkpoint = service.slice(start, end);
  for (const operation of ["editorialWriterCheckpointExecutor", "createArtifact", "transitionPipelineStep",
    "createRuntimeAuditRecord", "transitionPipelineRun"]) assert.ok(checkpoint.includes(operation), operation);
  assert.ok(checkpoint.indexOf("createArtifact") > checkpoint.indexOf("editorialWriterCheckpointExecutor"));
});

test("narrative artifact has exact ownership and complete provenance", () => {
  assert.match(service, /factoryObjectId: persistedEditorialNarrative\.factoryObjectId/);
  for (const field of ["narrativeOutputFingerprint", "promptLineage", "writingPolicyFingerprint",
    "providerRuntimeFingerprint", "selectedMilestoneRefs", "evidenceRefs"]) {
    assert.match(service, new RegExp(field));
  }
});

test("validation and package assembly fail closed without exact narrative lineage", () => {
  assert.match(service, /assertEditorialNarrativeCheckpoint/);
  assert.match(service, /PUBLICATION_NARRATIVE_CHECKPOINT_REQUIRED/);
  assert.match(service, /PUBLICATION_NARRATIVE_LINEAGE_MISMATCH/);
  assert.match(service, /PUBLICATION_NARRATIVE_COVERAGE_INCOMPLETE/);
  assert.match(service, /narrativeArtifactId/);
});

test("narrative remains excluded from canonical Governance authority", () => {
  assert.match(service, /EDITORIAL_NARRATIVE_NOT_PACKAGEABLE/);
  assert.match(service, /PUBLICATION_NARRATIVE_AUTHORITY_BOUNDARY_VIOLATION/);
  assert.match(service, /factoryObjectRefs\.includes\(narrative\.factoryObjectId\)/);
  assert.doesNotMatch(adapter, /governance|historical-library|published-memory|projection/i);
});

test("explicit regeneration has immutable revision inputs while resume never creates a revision", () => {
  assert.match(adapter, /revision: input\.revision/);
  assert.match(adapter, /supersedesNarrativeId: input\.supersedesNarrativeId/);
  assert.match(narrativeRepository, /INSERT INTO factory_editorial_narrative_revisions/);
  assert.doesNotMatch(narrativeRepository, /UPDATE factory_editorial_narratives/);
});
