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

test("model-derived semantic versions converge across execution provenance and split on semantic policy", () => {
  const firstMap = buildResearchMap(TEST_CONTEXT, scope, mapPayload, modelRef("execution-a"));
  const secondMap = buildResearchMap(TEST_CONTEXT, scope, mapPayload, modelRef("execution-b"));
  assert.equal(firstMap.researchMapId, secondMap.researchMapId);
  assert.equal(firstMap.payloadHash, secondMap.payloadHash);

  const queryPayload = { queries: [{ queryId: "query-launch", researchQuestionIds: ["question-launch"], role: "PHASE_DIMENSION" as const, intendedSourceClass: "PRIMARY_INSTITUTIONAL" as const, aliasesAndTerms: ["Apollo 11"], language: "en", geography: ["Earth"], providerQuery: "Apollo 11 launch NASA", providerReportedQueries: [], budgetUnits: 1, resultArtifactIds: [] }], budget: scope.researchBudget };
  assert.equal(buildQueryPlan(TEST_CONTEXT, scope, firstMap, queryPayload, modelRef("execution-a")).queryPlanId, buildQueryPlan({ ...TEST_CONTEXT, runId: "other-run", createdAt: "2027-01-01T00:00:00.000Z" }, scope, firstMap, queryPayload, modelRef("execution-b")).queryPlanId);

  const claimPayload = { scopeContractId: scope.scopeContractId, subject: { kind: "EVENT" as const, id: null, label: "Apollo 11 launch" }, predicate: "OCCURRENCE" as const, object: { kind: "TEXT" as const, id: null, value: "Apollo 11 launched" }, normalizedAssertion: "Apollo 11 launched", claimType: "OCCURRENCE" as const, risk: "ROUTINE" as const, temporal: { start: date(1969, "DAY", 7, 16), end: null }, candidateEventClusterId: "cluster-launch", locationEntityIds: [], qualifiers: [], extractedFromSnapshotId: "snapshot-launch", extractedFromSegmentIds: ["segment-launch"], conflictState: "NONE" as const, validationState: "STRUCTURALLY_VALID" as const, evidenceVerdictId: null, supersedesClaimVersionId: null };
  const firstClaim = buildAtomicClaimVersion(TEST_CONTEXT, claimPayload, modelRef("execution-a"));
  const secondClaim = buildAtomicClaimVersion(TEST_CONTEXT, claimPayload, modelRef("execution-b"));
  assert.equal(firstClaim.claimVersionId, secondClaim.claimVersionId);

  const entityPayload = { version: 1, entityType: "Institution" as const, canonicalName: "NASA", language: "en", externalIdentifiers: [], activeTemporal: null, geographyKeys: ["United States"], state: "FACTORY_CANDIDATE" as const, resolutionState: "RESOLVED" as const, identityEvidenceSegmentIds: ["segment-launch"], supersedesEntityVersionId: null };
  assert.equal(buildCanonicalEntityVersion(TEST_CONTEXT, entityPayload, modelRef("execution-a")).entityVersionId, buildCanonicalEntityVersion(TEST_CONTEXT, entityPayload, modelRef("execution-b")).entityVersionId);

  const eventPayload = { version: 1, scopeContractId: scope.scopeContractId, canonicalTitle: "Apollo 11 launches", semanticClass: "EVENT" as const, eventSubtype: "OCCURRENCE" as const, temporal: { start: date(1969, "DAY", 7, 16), end: null, uncertainty: null }, actionKey: "apollo 11 launched", primaryEntityKeys: ["entity-nasa"], locationKeys: ["place-kennedy-space-center"], coreClaimVersionIds: [firstClaim.claimVersionId], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE" as const, canonicalizationState: "RESOLVED" as const, parentEventId: null, supersedesEventVersionId: null };
  assert.equal(buildCanonicalEventVersion(TEST_CONTEXT, eventPayload, modelRef("execution-a")).eventVersionId, buildCanonicalEventVersion(TEST_CONTEXT, eventPayload, modelRef("execution-b")).eventVersionId);
  assert.notEqual(buildResearchMap({ ...TEST_CONTEXT, policyVersion: "research-map-policy-v2" }, scope, mapPayload, modelRef("execution-a")).researchMapId, firstMap.researchMapId);
});

test("provisional publisher bootstrap ignores caller topic policy provenance", () => {
  const first = provisionalPublisher(TEST_CONTEXT, "https://example.org/history", "en");
  const second = provisionalPublisher({ ...TEST_CONTEXT, runId: "other-run", createdAt: "2027-01-01T00:00:00.000Z", policyVersion: "knowledge-coverage-v2-a3.2" }, "https://example.org/other", "fr");
  assert.deepEqual(second, first);
});

test("completed knowledge-set identity excludes execution and normalizes set-like membership", () => {
  const payload = { completionPlanId: "completion-plan", initialCoverageAuditId: "audit-initial", initialCoverageAuditPayloadHash: "a".repeat(64), finalCoverageAuditId: "audit-final", finalCoverageAuditPayloadHash: "b".repeat(64), scopeContractId: "scope-contract", scopePayloadHash: "c".repeat(64), researchMapId: "research-map", researchMapPayloadHash: "d".repeat(64), candidateEventVersionIds: ["event-version-b", "event-version-a"], candidateClaimVersionIds: ["claim-version-b", "claim-version-a"], authorityVerdictIds: ["verdict-b", "verdict-a"], conflictSetIds: [], unresolvedGapIds: [], finalVerdict: "SUFFICIENT" as const };
  const first = buildKnowledgeCompletionResult(TEST_CONTEXT, payload);
  assert.equal(buildKnowledgeCompletionResult(TEST_CONTEXT, payload).completionResultId, first.completionResultId);
  assert.equal(buildKnowledgeCompletionResult({ ...TEST_CONTEXT, runId: "other-run" }, payload).completionResultId, first.completionResultId);
  assert.equal(buildKnowledgeCompletionResult(TEST_CONTEXT, { ...payload, candidateEventVersionIds: [...payload.candidateEventVersionIds].reverse(), candidateClaimVersionIds: [...payload.candidateClaimVersionIds].reverse(), authorityVerdictIds: [...payload.authorityVerdictIds].reverse() }).completionResultId, first.completionResultId);
  assert.equal(verifyPayloadHash(first), true);
});
