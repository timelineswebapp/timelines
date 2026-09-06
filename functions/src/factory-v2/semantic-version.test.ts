import assert from "node:assert/strict";
import test from "node:test";
import type { AtomicClaimVersion, ClaimAuthorityVerdict } from "./contracts";
import { selectionArtifactSchema, type SignificanceProposal } from "./contracts/assembly";
import { buildCanonicalEventVersion, buildQueryPlan, buildResearchMap, semanticArtifactId } from "./contracts/builders";
import { auditKnowledgeCoverage, buildCompletionResearchMap, planGapDirectedCompletion } from "./coverage";
import { assembleTimelineSelection } from "./selection";
import { attachPayloadHash } from "./hashing";
import { TEST_CONTEXT, date, scopeFixture } from "./test-fixtures";

const scope = scopeFixture();
const mapPayload = {
  version: 1,
  phases: scope.expectedPhases.map((label, index) => ({ phaseId: `phase-${index + 1}`, label, temporalRule: `Locked ${label} phase.`, required: true, rationale: `${label} is material to the locked scope.` })),
  dimensions: scope.requiredDimensions.map((label, index) => ({ dimensionId: `dimension-${index + 1}`, label, required: true, rationale: `${label} is material to the locked scope.` })),
  entities: [],
  questions: scope.expectedPhases.map((label, index) => ({ questionId: `question-${index + 1}`, text: `What authoritative evidence covers ${label}?`, phaseIds: [`phase-${index + 1}`], dimensionIds: [`dimension-${index % scope.requiredDimensions.length + 1}`], claimTypesExpected: ["OCCURRENCE" as const], likelySourceClasses: ["PRIMARY_INSTITUTIONAL" as const], expectedAuthorities: ["Institutional archive"], languages: ["en"], geography: ["Earth"], contested: false, dateCritical: true, priority: "CRITICAL" as const, state: "UNRESEARCHED" as const })),
  terminology: [],
  knownUncertainty: []
};

function context(policyVersion: string, runId = "semantic-run", createdAt = "2026-09-06T00:00:00.000Z") {
  return { ...TEST_CONTEXT, runId, createdAt, policyVersion };
}

test("semantic identity property matrix excludes every execution-only determinant", () => {
  const payload = { parent: "semantic-parent-v1", meaning: "locked meaning" };
  const base = context("semantic-policy-v1");
  const expected = semanticArtifactId("property", base, payload);
  for (const variant of [
    { ...base, runId: "retry-run" },
    { ...base, createdAt: "2027-01-01T00:00:00.000Z" },
    { ...base, runId: "new-acquisition-attempt", createdAt: "2028-01-01T00:00:00.000Z" }
  ]) assert.equal(semanticArtifactId("property", variant, payload), expected);
  assert.equal(semanticArtifactId("property", base, payload), expected);
});

test("semantic identity property matrix versions policy, schema, meaning, and semantic parent", () => {
  const payload = { parent: "semantic-parent-v1", meaning: "locked meaning" };
  const base = context("semantic-policy-v1");
  const expected = semanticArtifactId("property", base, payload);
  assert.notEqual(semanticArtifactId("property", context("semantic-policy-v2"), payload), expected);
  assert.notEqual(semanticArtifactId("property", base, payload, { schemaVersion: "factory-v2-a.5" }), expected);
  assert.notEqual(semanticArtifactId("property", base, { ...payload, meaning: "changed meaning" }), expected);
  assert.notEqual(semanticArtifactId("property", base, { ...payload, parent: "semantic-parent-v2" }), expected);
  assert.equal(semanticArtifactId("property", { ...base, runId: "execution-parent-retry" }, payload), expected);
});

test("A3.4 Research Map collision reconstructs as policy v1/v2 coexistence, never one ID with two payloads", () => {
  const policy1 = context("knowledge-coverage-v2-a3.1", "v2-a3-web-98332efd-8842-490f-8ecd-d080d8789862", "2026-09-06T15:40:38.111Z");
  const policy2 = context("knowledge-coverage-v2-a3.2", "v2-a3-web-cbe1e74f-2030-4c0d-8170-30178f73dab3", "2026-09-06T18:18:01.065Z");
  const v1 = buildResearchMap(policy1, scope, mapPayload);
  const v2 = buildResearchMap(policy2, scope, { ...mapPayload, version: 2 });
  assert.notEqual(v2.researchMapId, v1.researchMapId);
  assert.notEqual(v2.payloadHash, v1.payloadHash);
  assert.equal(buildResearchMap({ ...policy2, runId: "retry", createdAt: "2026-09-07T00:00:00.000Z" }, scope, { ...mapPayload, version: 2 }).researchMapId, v2.researchMapId);
});

test("cross-artifact A3 semantic-policy chain creates immutable successors through final re-audit", () => {
  const ids = (policyVersion: string) => {
    const chainContext = context(policyVersion);
    const map = buildResearchMap(chainContext, scope, mapPayload);
    const queryPlan = buildQueryPlan(chainContext, scope, map, { queries: [{ queryId: "query-1", researchQuestionIds: [map.questions[0]!.questionId], role: "PHASE_DIMENSION", intendedSourceClass: "PRIMARY_INSTITUTIONAL", aliasesAndTerms: [scope.title], language: "en", geography: ["Earth"], providerQuery: "Apollo 11 authoritative chronology", providerReportedQueries: [], budgetUnits: 1, resultArtifactIds: [] }], budget: scope.researchBudget });
    const initial = auditKnowledgeCoverage({ context: chainContext, stage: "INITIAL", scope, researchMap: map, sourceKnowledgeRunIds: ["execution-run"], claims: [], authorityVerdicts: [], conflicts: [], events: [] });
    const plan = planGapDirectedCompletion({ context: chainContext, scope, researchMap: map, audit: initial, originalKnowledgeRunId: "execution-run" });
    const completionMap = buildCompletionResearchMap({ context: chainContext, scope, parent: map, plan });
    const final = auditKnowledgeCoverage({ context: chainContext, stage: "FINAL", scope, researchMap: completionMap, sourceKnowledgeRunIds: ["execution-run", "retry-run"], claims: [], authorityVerdicts: [], conflicts: [], events: [] });
    return [map.researchMapId, queryPlan.queryPlanId, initial.coverageAuditId, plan.completionPlanId, completionMap.researchMapId, final.coverageAuditId];
  };
  const v1 = ids("knowledge-coverage-v2-a3.1");
  const v2 = ids("knowledge-coverage-v2-a3.2");
  assert.equal(new Set(v1).size, v1.length);
  v1.forEach((id, index) => assert.notEqual(v2[index], id));
});

test("B1 selection policy v1/v2 artifacts coexist while execution-only reruns converge", () => {
  const map = buildResearchMap(TEST_CONTEXT, scope, mapPayload);
  const event = buildCanonicalEventVersion(TEST_CONTEXT, { version: 1, scopeContractId: scope.scopeContractId, canonicalTitle: "Apollo 11 launches", semanticClass: "EVENT", eventSubtype: "OCCURRENCE", temporal: { start: date(1969, "DAY", 7, 16), end: null, uncertainty: null }, actionKey: "apollo 11 launches", primaryEntityKeys: ["entity-apollo"], locationKeys: ["place-earth"], coreClaimVersionIds: ["claim-launch"], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE", canonicalizationState: "RESOLVED", parentEventId: null, supersedesEventVersionId: null });
  const claims = [{ claimVersionId: "claim-launch", validationState: "SUPPORTED" } as AtomicClaimVersion];
  const verdicts = [{ claimVersionId: "claim-launch", verdict: "SUPPORTED" } as ClaimAuthorityVerdict];
  const significance: SignificanceProposal = { judgments: [{ eventVersionId: event.eventVersionId, significanceClass: "ESSENTIAL", comparativeRank: 1, criteria: { turningPointValue: "HIGH", causalImportance: "HIGH", consequence: "HIGH", institutionalImportance: "HIGH", adoptionOrScale: "HIGH", explanatoryValue: "HIGH", topicRelevance: "HIGH", historiographicalProminence: "HIGH", relationshipToLaterDevelopments: "HIGH", uniqueness: "HIGH" }, rationale: "This verified occurrence directly anchors the locked mission chronology.", phaseCoverage: map.phases.map((phase) => ({ phaseId: phase.phaseId, relation: "PRIMARY", rationale: "The occurrence anchors this locked phase." })), dimensionCoverage: map.dimensions.map((dimension) => ({ dimensionId: dimension.dimensionId, relation: "PRIMARY", rationale: "The occurrence addresses this locked dimension." })), redundantWithEventVersionIds: [], redundancyRationale: null }], comparisons: [], completenessFindings: [] };
  const build = (selectionPolicyVersion: string, runId = "b1-run") => assembleTimelineSelection({ context: { ...TEST_CONTEXT, runId, sourceKnowledgeRunId: "certified-a3-run" }, scope, researchMap: map, events: [event], claims, authorityVerdicts: verdicts, conflicts: [], significance, modelExecutionRef: null, selectionPolicyVersion });
  const v1 = build("evidence-backed-selection-v2-b.1");
  const v2 = build("evidence-backed-selection-v2-b.2");
  assert.notEqual(v2.selectionArtifactId, v1.selectionArtifactId);
  assert.equal(build("evidence-backed-selection-v2-b.1", "b1-retry").selectionArtifactId, v1.selectionArtifactId);
  const legacy = selectionArtifactSchema.parse(attachPayloadHash({ ...v1, schemaVersion: "factory-v2-b.1", sourceKnowledgeBundle: { pipelineVersion: "factory-v2-a.10", schemaVersion: "factory-v2-a.3", policyVersion: "evidence-first-v2-a.9", promptVersion: "factory-v2-a-prompts.8" } }));
  assert.equal(legacy.schemaVersion, "factory-v2-b.1");
});
