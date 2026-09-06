import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalEventVersion, buildResearchMap } from "./contracts/builders";
import type { AtomicClaimVersion } from "./contracts";
import { evaluateHistoricalSignificance } from "./selection-model";
import { TEST_CONTEXT, date, scopeFixture } from "./test-fixtures";
import type { V2GenerateRequest } from "./vertex";

const scope = scopeFixture();
const map = buildResearchMap(TEST_CONTEXT, scope, {
  version: 1,
  phases: [{ phaseId: "phase-launch", label: "Launch (1969)", temporalRule: "The launch phase is bounded to 1969.", required: true, rationale: "Required mission opening phase." }],
  dimensions: [{ dimensionId: "dimension-operational", label: "Operational", required: true, rationale: "Required operational dimension." }],
  entities: [],
  questions: [{ questionId: "question-launch", text: "What verified event opened the Apollo 11 mission chronology?", phaseIds: ["phase-launch"], dimensionIds: ["dimension-operational"], claimTypesExpected: ["OCCURRENCE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["Earth"], contested: false, dateCritical: true, priority: "CRITICAL", state: "SATISFIED" }],
  terminology: [],
  knownUncertainty: []
});
const event = buildCanonicalEventVersion(TEST_CONTEXT, { version: 1, scopeContractId: scope.scopeContractId, canonicalTitle: "Apollo 11 launches", semanticClass: "EVENT", eventSubtype: "OCCURRENCE", temporal: { start: date(1969, "DAY", 7, 16), end: null, uncertainty: null }, actionKey: "launch", primaryEntityKeys: ["entity-apollo-11"], locationKeys: ["place-kennedy"], coreClaimVersionIds: ["claim-launch"], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE", canonicalizationState: "RESOLVED", parentEventId: null, supersedesEventVersionId: null });
const claim = { claimVersionId: "claim-launch", normalizedAssertion: "Apollo 11 launched on July 16, 1969.", claimType: "OCCURRENCE", risk: "ROUTINE", qualifiers: [], validationState: "SUPPORTED" } as unknown as AtomicClaimVersion;
const criteria = { turningPointValue: "HIGH", causalImportance: "MEDIUM", consequence: "HIGH", institutionalImportance: "HIGH", adoptionOrScale: "MEDIUM", explanatoryValue: "HIGH", topicRelevance: "HIGH", historiographicalProminence: "HIGH", relationshipToLaterDevelopments: "HIGH", uniqueness: "HIGH" };

function response(phaseId = "phase-launch") {
  return JSON.stringify({ judgments: [{ eventVersionId: event.eventVersionId, significanceClass: "ESSENTIAL", comparativeRank: 1, criteria, rationale: "The launch is an indispensable boundary event in the locked Apollo 11 mission chronology.", phaseCoverage: [{ phaseId, relation: "PRIMARY", rationale: "The occurrence directly represents the locked launch phase." }], dimensionCoverage: [{ dimensionId: "dimension-operational", relation: "PRIMARY", rationale: "The launch directly represents mission operations." }], redundantWithEventVersionIds: [], redundancyRationale: null }], comparisons: [], completenessFindings: [] });
}

test("B1 significance evaluation is bounded, schema constrained, and has no research tool", async () => {
  const requests: V2GenerateRequest[] = [];
  const result = await evaluateHistoricalSignificance({ context: { ...TEST_CONTEXT, sourceKnowledgeRunId: "certified-v2-a-run" }, scope, researchMap: map, eligibleEvents: [event], approvedClaims: [claim], provider: { generateContent: async (request) => { requests.push(request); return { text: response(), usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 } }; } } });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.config.tools, undefined);
  assert.equal(result.proposal.judgments[0]!.significanceClass, "ESSENTIAL");
  assert.equal(result.execution.validationState, "VALID");
  assert.equal(result.execution.usage.monetaryCost, null);
});

test("B1 significance evaluation permits one semantic repair and rejects invented map references", async () => {
  let calls = 0;
  const result = await evaluateHistoricalSignificance({ context: { ...TEST_CONTEXT, sourceKnowledgeRunId: "certified-v2-a-run" }, scope, researchMap: map, eligibleEvents: [event], approvedClaims: [claim], provider: { generateContent: async () => ({ text: calls++ === 0 ? response("phase-invented") : response() }) } });
  assert.equal(calls, 2);
  assert.equal(result.execution.validationState, "REPAIRED");
  assert.equal(result.execution.repairAttempt, 1);
});

test("B1 model execution identity covers exact usage and timing provenance", async () => {
  const context = { ...TEST_CONTEXT, sourceKnowledgeRunId: "certified-v2-a-run" };
  const first = await evaluateHistoricalSignificance({ context, scope, researchMap: map, eligibleEvents: [event], approvedClaims: [claim], provider: { generateContent: async () => ({ text: response(), usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 } }) } });
  const changedUsage = await evaluateHistoricalSignificance({ context, scope, researchMap: map, eligibleEvents: [event], approvedClaims: [claim], provider: { generateContent: async () => ({ text: response(), usageMetadata: { promptTokenCount: 101, candidatesTokenCount: 50, totalTokenCount: 151 } }) } });
  assert.notEqual(changedUsage.execution.executionId, first.execution.executionId);
});
