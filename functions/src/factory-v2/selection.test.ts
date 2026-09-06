import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalEventVersion, buildResearchMap } from "./contracts/builders";
import type { AtomicClaimVersion, CanonicalEventVersion, ClaimAuthorityVerdict } from "./contracts";
import type { SignificanceProposal } from "./contracts/assembly";
import { assembleTimelineSelection } from "./selection";
import { TEST_CONTEXT, date, scopeFixture } from "./test-fixtures";

const scope = scopeFixture();
const map = buildResearchMap(TEST_CONTEXT, scope, {
  version: 1,
  phases: scope.expectedPhases.map((label, index) => ({ phaseId: `phase-${index + 1}`, label, temporalRule: `Locked mission phase ${label}.`, required: true, rationale: `Required locked phase ${label}.` })),
  dimensions: scope.requiredDimensions.map((label, index) => ({ dimensionId: `dimension-${index + 1}`, label, required: true, rationale: `Required locked dimension ${label}.` })),
  entities: [],
  questions: scope.expectedPhases.map((label, index) => ({ questionId: `question-${index + 1}`, text: `What occurred during the locked ${label} mission phase?`, phaseIds: [`phase-${index + 1}`], dimensionIds: [`dimension-${index % 2 + 1}`], claimTypesExpected: ["OCCURRENCE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["Earth"], contested: false, dateCritical: true, priority: "CRITICAL", state: "SATISFIED" })),
  terminology: [],
  knownUncertainty: []
});

function event(index: number, overrides: Partial<Parameters<typeof buildCanonicalEventVersion>[1]> = {}): CanonicalEventVersion {
  return buildCanonicalEventVersion(TEST_CONTEXT, {
    version: 1,
    scopeContractId: scope.scopeContractId,
    canonicalTitle: `Mission event ${index}`,
    semanticClass: "EVENT",
    eventSubtype: "OCCURRENCE",
    temporal: { start: date(1969, "DAY", 7, 16 + index), end: null, uncertainty: null },
    actionKey: `action-${index}`,
    primaryEntityKeys: ["entity-apollo-11"],
    locationKeys: ["place-mission"],
    coreClaimVersionIds: [`claim-${index}`],
    supportingClaimVersionIds: [],
    authorityState: "FACTORY_CANDIDATE",
    canonicalizationState: "RESOLVED",
    parentEventId: null,
    supersedesEventVersionId: null,
    ...overrides
  });
}

function claimsAndVerdicts(events: CanonicalEventVersion[]) {
  const claims = events.flatMap((item) => item.coreClaimVersionIds.map((claimVersionId) => ({ claimVersionId, validationState: "SUPPORTED" } as AtomicClaimVersion)));
  const authorityVerdicts = events.flatMap((item) => item.coreClaimVersionIds.map((claimVersionId) => ({ claimVersionId, verdict: "SUPPORTED" } as ClaimAuthorityVerdict)));
  return { claims, authorityVerdicts };
}

const criteria = { turningPointValue: "MEDIUM", causalImportance: "LOW", consequence: "MEDIUM", institutionalImportance: "MEDIUM", adoptionOrScale: "LOW", explanatoryValue: "HIGH", topicRelevance: "HIGH", historiographicalProminence: "MEDIUM", relationshipToLaterDevelopments: "MEDIUM", uniqueness: "HIGH" } as const;

function proposal(events: CanonicalEventVersion[], overrides: Partial<Record<string, Partial<SignificanceProposal["judgments"][number]>>> = {}): SignificanceProposal {
  return {
    judgments: events.map((item, index) => ({
      eventVersionId: item.eventVersionId,
      significanceClass: "MAJOR",
      comparativeRank: index + 1,
      criteria,
      rationale: `This verified occurrence has direct explanatory value in the locked mission chronology ${index + 1}.`,
      phaseCoverage: [{ phaseId: `phase-${index % 3 + 1}`, relation: "PRIMARY", rationale: "The event directly represents this locked historical phase." }],
      dimensionCoverage: [{ dimensionId: `dimension-${index % 2 + 1}`, relation: "PRIMARY", rationale: "The event directly represents this locked topic dimension." }],
      redundantWithEventVersionIds: [],
      redundancyRationale: null,
      ...overrides[item.eventVersionId]
    })),
    comparisons: [],
    completenessFindings: []
  };
}

function select(events: CanonicalEventVersion[], significance = proposal(events)) {
  const supporting = claimsAndVerdicts(events);
  return assembleTimelineSelection({
    context: { ...TEST_CONTEXT, sourceKnowledgeRunId: "v2-a-certified-run" },
    scope,
    researchMap: map,
    events,
    claims: supporting.claims,
    authorityVerdicts: supporting.authorityVerdicts,
    conflicts: [],
    significance,
    modelExecutionRef: null
  });
}

test("B1 preserves a 30-candidate verified pool while selecting a bounded chronological view", () => {
  const events = Array.from({ length: 30 }, (_, index) => event(index % 8, { canonicalTitle: `Distinct candidate ${index}`, actionKey: `distinct-action-${index}` }));
  const result = select(events);
  assert.equal(result.completeCandidateEventVersionIds.length, 30);
  assert.equal(result.selectedEventVersionIds.length, 10);
  assert.equal(result.status, "PASS");
  assert.equal(result.payloadHash.length, 64);
});

test("B1 deterministically excludes non-events, scope drift, unsupported claims, and failed authority", () => {
  const valid = Array.from({ length: 6 }, (_, index) => event(index));
  const nonEvent = event(6, { semanticClass: "STATE_LEGACY", eventSubtype: null, canonicalizationState: "INELIGIBLE" });
  const outside = event(7, { temporal: { start: date(1995, "YEAR"), end: null, uncertainty: null } });
  const weak = event(8);
  const supporting = claimsAndVerdicts([...valid, nonEvent, outside, weak]);
  supporting.authorityVerdicts = supporting.authorityVerdicts.map((verdict) => verdict.claimVersionId === weak.coreClaimVersionIds[0] ? ({ ...verdict, verdict: "INSUFFICIENT" } as ClaimAuthorityVerdict) : verdict);
  const result = assembleTimelineSelection({ context: { ...TEST_CONTEXT, sourceKnowledgeRunId: "v2-a-certified-run" }, scope, researchMap: map, events: [...valid, nonEvent, outside, weak], claims: supporting.claims, authorityVerdicts: supporting.authorityVerdicts, conflicts: [], significance: proposal([...valid, nonEvent, outside, weak]), modelExecutionRef: null });
  assert.deepEqual(result.assessments.find((item) => item.eventVersionId === nonEvent.eventVersionId)?.eligibilityReasons, ["SEMANTIC_TYPE_INELIGIBLE", "SCOPE_INCOMPATIBLE"]);
  assert.ok(result.assessments.find((item) => item.eventVersionId === outside.eventVersionId)?.eligibilityReasons.includes("SCOPE_INCOMPATIBLE"));
  assert.ok(result.assessments.find((item) => item.eventVersionId === weak.eventVersionId)?.eligibilityReasons.includes("SOURCE_AUTHORITY_BURDEN_FAILED"));
});

test("B1 fails closed when ESSENTIAL history exceeds the public event limit", () => {
  const events = Array.from({ length: 21 }, (_, index) => event(index % 8, { canonicalTitle: `Essential candidate ${index}`, actionKey: `essential-action-${index}` }));
  const significance = proposal(events);
  significance.judgments = significance.judgments.map((judgment) => ({ ...judgment, significanceClass: "ESSENTIAL" }));
  const result = select(events, significance);
  assert.equal(result.status, "FAILED");
  assert.ok(result.failureCodes.includes("EVENT_LIMIT_UNSATISFIABLE"));
  assert.equal(result.selectedEventVersionIds.length, 20);
});

test("B1 records material phase gaps instead of filling equal temporal buckets", () => {
  const events = Array.from({ length: 6 }, (_, index) => event(index));
  const significance = proposal(events);
  significance.judgments = significance.judgments.map((judgment) => ({ ...judgment, phaseCoverage: [{ phaseId: "phase-1", relation: "PRIMARY", rationale: "Only the opening phase is directly represented." }] }));
  const result = select(events, significance);
  assert.equal(result.status, "FAILED");
  assert.deepEqual(result.coverageSummary.missingPhaseIds, ["phase-2", "phase-3"]);
  assert.ok(result.failureCodes.includes("COVERAGE_GAP_MATERIAL"));
  assert.ok(result.completenessFindings.some((finding) => finding.classification === "MISSING_MATERIAL_MILESTONE" && finding.blocking));
});

test("B1 merges only deterministically supported redundancy and preserves same-day distinct events", () => {
  const first = event(0);
  const duplicate = event(0, { canonicalTitle: "Alternate label for mission event 0", candidateEventId: "11111111-1111-4111-8111-111111111111" });
  const distinct = event(0, { canonicalTitle: "Same-day distinct action", actionKey: "different-action" });
  const rest = Array.from({ length: 5 }, (_, index) => event(index + 1));
  const events = [first, duplicate, distinct, ...rest];
  const significance = proposal(events, {
    [first.eventVersionId]: { redundantWithEventVersionIds: [duplicate.eventVersionId], redundancyRationale: "Both candidates resolve to the same occurrence and the kept version is more complete." },
    [duplicate.eventVersionId]: { redundantWithEventVersionIds: [first.eventVersionId], redundancyRationale: "Both candidates resolve to the same occurrence and the kept version is more complete." },
    [distinct.eventVersionId]: { redundantWithEventVersionIds: [first.eventVersionId], redundancyRationale: "A date match alone must not merge a distinct action." }
  });
  const result = select(events, significance);
  assert.equal(result.redundancyDecisions.length, 1);
  assert.equal(result.assessments.find((item) => item.eventVersionId === duplicate.eventVersionId)?.selectionState, "EXCLUDED_REDUNDANT");
  assert.notEqual(result.assessments.find((item) => item.eventVersionId === distinct.eventVersionId)?.selectionState, "EXCLUDED_REDUNDANT");
});

test("B1 rejects significance mappings outside the locked Research Map", () => {
  const events = Array.from({ length: 6 }, (_, index) => event(index));
  const significance = proposal(events);
  significance.judgments[0]!.phaseCoverage = [{ phaseId: "phase-invented", relation: "PRIMARY", rationale: "This invented phase must be rejected deterministically." }];
  assert.throws(() => select(events, significance), /outside the locked Research Map/);
});

