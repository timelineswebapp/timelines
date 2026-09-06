import assert from "node:assert/strict";
import test from "node:test";
import { provisionalPublisher } from "./orchestrator";
import { buildAtomicClaimVersion, buildCanonicalEntityVersion, buildCanonicalEventVersion, buildQueryPlan, buildResearchMap, executionArtifactId } from "./contracts/builders";
import { buildKnowledgeCompletionResult } from "./coverage";
import { verifyPayloadHash } from "./hashing";
import { TEST_CONTEXT, date, scopeFixture } from "./test-fixtures";

const scope = scopeFixture();
const modelRef = (executionId: string) => ({ executionId, model: "gemini-test", location: "global", promptVersion: "factory-v2-a-prompts.8", promptHash: "a".repeat(64), responseHash: "b".repeat(64) });
const mapPayload = {
  version: 1,
  phases: [{ phaseId: "phase-launch", label: "launch", temporalRule: "The launch phase is bounded by the locked mission dates.", required: true, rationale: "Launch is material." }],
  dimensions: [{ dimensionId: "dimension-operations", label: "operational", required: true, rationale: "Operations are material." }],
  entities: [],
  questions: [{ questionId: "question-launch", text: "What authoritative evidence establishes the mission launch?", phaseIds: ["phase-launch"], dimensionIds: ["dimension-operations"], claimTypesExpected: ["OCCURRENCE" as const], likelySourceClasses: ["PRIMARY_INSTITUTIONAL" as const], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["Earth"], contested: false, dateCritical: true, priority: "CRITICAL" as const, state: "UNRESEARCHED" as const }],
  terminology: [],
  knownUncertainty: []
};

test("execution artifact identity is idempotent for an exact observation and changes with execution provenance", () => {
  const payload = { stage: "AUDIT", startedAt: "2026-09-06T00:00:00.000Z", latencyMs: 7 };
  const first = executionArtifactId("test-execution", TEST_CONTEXT, payload);
  assert.equal(executionArtifactId("test-execution", TEST_CONTEXT, payload), first);
  assert.notEqual(executionArtifactId("test-execution", { ...TEST_CONTEXT, runId: "run-456" }, payload), first);
  assert.notEqual(executionArtifactId("test-execution", TEST_CONTEXT, { ...payload, latencyMs: 8 }), first);
});

test("model-derived semantic versions include exact immutable model provenance", () => {
  const firstMap = buildResearchMap(TEST_CONTEXT, scope, mapPayload, modelRef("execution-a"));
  const secondMap = buildResearchMap(TEST_CONTEXT, scope, mapPayload, modelRef("execution-b"));
  assert.notEqual(firstMap.researchMapId, secondMap.researchMapId);

  const queryPayload = { queries: [{ queryId: "query-launch", researchQuestionIds: ["question-launch"], role: "PHASE_DIMENSION" as const, intendedSourceClass: "PRIMARY_INSTITUTIONAL" as const, aliasesAndTerms: ["Apollo 11"], language: "en", geography: ["Earth"], providerQuery: "Apollo 11 launch NASA", providerReportedQueries: [], budgetUnits: 1, resultArtifactIds: [] }], budget: scope.researchBudget };
  assert.notEqual(buildQueryPlan(TEST_CONTEXT, scope, firstMap, queryPayload, modelRef("execution-a")).queryPlanId, buildQueryPlan(TEST_CONTEXT, scope, firstMap, queryPayload, modelRef("execution-b")).queryPlanId);

  const claimPayload = { scopeContractId: scope.scopeContractId, subject: { kind: "EVENT" as const, id: null, label: "Apollo 11 launch" }, predicate: "OCCURRENCE" as const, object: { kind: "TEXT" as const, id: null, value: "Apollo 11 launched" }, normalizedAssertion: "Apollo 11 launched", claimType: "OCCURRENCE" as const, risk: "ROUTINE" as const, temporal: { start: date(1969, "DAY", 7, 16), end: null }, candidateEventClusterId: "cluster-launch", locationEntityIds: [], qualifiers: [], extractedFromSnapshotId: "snapshot-launch", extractedFromSegmentIds: ["segment-launch"], conflictState: "NONE" as const, validationState: "STRUCTURALLY_VALID" as const, evidenceVerdictId: null, supersedesClaimVersionId: null };
  const firstClaim = buildAtomicClaimVersion(TEST_CONTEXT, claimPayload, modelRef("execution-a"));
  const secondClaim = buildAtomicClaimVersion(TEST_CONTEXT, claimPayload, modelRef("execution-b"));
  assert.notEqual(firstClaim.claimVersionId, secondClaim.claimVersionId);

  const entityPayload = { version: 1, entityType: "Institution" as const, canonicalName: "NASA", language: "en", externalIdentifiers: [], activeTemporal: null, geographyKeys: ["United States"], state: "FACTORY_CANDIDATE" as const, resolutionState: "RESOLVED" as const, identityEvidenceSegmentIds: ["segment-launch"], supersedesEntityVersionId: null };
  assert.notEqual(buildCanonicalEntityVersion(TEST_CONTEXT, entityPayload, modelRef("execution-a")).entityVersionId, buildCanonicalEntityVersion(TEST_CONTEXT, entityPayload, modelRef("execution-b")).entityVersionId);

  const eventPayload = { version: 1, scopeContractId: scope.scopeContractId, canonicalTitle: "Apollo 11 launches", semanticClass: "EVENT" as const, eventSubtype: "OCCURRENCE" as const, temporal: { start: date(1969, "DAY", 7, 16), end: null, uncertainty: null }, actionKey: "apollo 11 launched", primaryEntityKeys: ["entity-nasa"], locationKeys: ["place-kennedy-space-center"], coreClaimVersionIds: [firstClaim.claimVersionId], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE" as const, canonicalizationState: "RESOLVED" as const, parentEventId: null, supersedesEventVersionId: null };
  assert.notEqual(buildCanonicalEventVersion(TEST_CONTEXT, eventPayload, modelRef("execution-a")).eventVersionId, buildCanonicalEventVersion(TEST_CONTEXT, eventPayload, modelRef("execution-b")).eventVersionId);
});

test("provisional publisher bootstrap ignores caller topic policy provenance", () => {
  const first = provisionalPublisher(TEST_CONTEXT, "https://example.org/history", "en");
  const second = provisionalPublisher({ ...TEST_CONTEXT, runId: "other-run", createdAt: "2027-01-01T00:00:00.000Z", policyVersion: "knowledge-coverage-v2-a3.2" }, "https://example.org/other", "fr");
  assert.deepEqual(second, first);
});

test("completion result identity covers run and telemetry while exact replay remains hash-valid", () => {
  const payload = { completionPlanId: "completion-plan", initialCoverageAuditId: "audit-initial", finalCoverageAuditId: "audit-final", acquisitionRunId: "acquisition-run", originalKnowledgeRunId: "source-run", newClaimVersionIds: [], newEventVersionIds: [], reusedEventVersionIds: [], unresolvedGapIds: [], budgetConsumed: { rounds: 1 as const, groundingCalls: 1, providerQueries: 2, sourceDocuments: 1, claimExtractions: 1, atomicClaims: 1, writes: 7 }, timings: { initialKnowledgeReuseMs: 1, coverageAuditMs: 2, gapAcquisitionMs: 3, reAuditMs: 4 }, finalVerdict: "SUFFICIENT" as const };
  const first = buildKnowledgeCompletionResult(TEST_CONTEXT, payload);
  assert.equal(buildKnowledgeCompletionResult(TEST_CONTEXT, payload).completionResultId, first.completionResultId);
  assert.notEqual(buildKnowledgeCompletionResult({ ...TEST_CONTEXT, runId: "other-run" }, payload).completionResultId, first.completionResultId);
  assert.notEqual(buildKnowledgeCompletionResult(TEST_CONTEXT, { ...payload, timings: { ...payload.timings, gapAcquisitionMs: 5 } }).completionResultId, first.completionResultId);
  assert.equal(verifyPayloadHash(first), true);
});
