import assert from "node:assert/strict";
import test from "node:test";
import { buildAtomicClaimVersion, buildCanonicalEventVersion, buildResearchMap, immutableEnvelope, parseSealedArtifact } from "./contracts/builders";
import { claimAuthorityVerdictSchema, claimConflictSetSchema, type AtomicClaimVersion, type CanonicalEventVersion, type ClaimAuthorityVerdict, type ClaimConflictSet } from "./contracts";
import { auditKnowledgeCoverage, buildCompletionResearchMap, buildKnowledgeCompletionResult, DEFAULT_COMPLETION_BUDGET, mergeKnowledgeEventVersions, planGapDirectedCompletion } from "./coverage";
import { contentAddressedId, deterministicUuid } from "./hashing";
import { date, scopeFixture, TEST_CONTEXT } from "./test-fixtures";

const scope = scopeFixture({
  title: "A Technology History",
  topicClass: "ONGOING_SUBJECT",
  chronologyStart: date(1980),
  chronologyEnd: null,
  ongoingAsOf: "2026-09-06",
  expectedPhases: ["Foundation (1980-1999)", "Expansion (2000-2019)", "Current (2020-Present)"],
  requiredDimensions: ["technology", "society"]
});

const phases = [
  { phaseId: "phase-foundation", label: "Foundation (1980-1999)", temporalRule: "Evidence dated from 1980 through 1999", required: true, rationale: "The locked foundation phase is material." },
  { phaseId: "phase-expansion", label: "Expansion (2000-2019)", temporalRule: "Evidence dated from 2000 through 2019", required: true, rationale: "The locked expansion phase is material." },
  { phaseId: "phase-current", label: "Current (2020-Present)", temporalRule: "Evidence dated from 2020 through the locked ongoing date", required: true, rationale: "The locked current phase is material." },
  { phaseId: "phase-optional", label: "Optional context (1970-1979)", temporalRule: "Evidence dated from 1970 through 1979", required: false, rationale: "This context is explicitly non-material." }
];
const dimensions = [
  { dimensionId: "dimension-tech", label: "technology", required: true, rationale: "Technology is a locked dimension." },
  { dimensionId: "dimension-society", label: "society", required: true, rationale: "Society is a locked dimension." }
];
const question = (questionId: string, phaseId: string, dimensionId: string, priority: "CRITICAL" | "IMPORTANT" = "CRITICAL") => ({ questionId, text: `What authoritative dated evidence covers ${phaseId} and ${dimensionId}?`, phaseIds: [phaseId], dimensionIds: [dimensionId], claimTypesExpected: ["OCCURRENCE" as const, "DATE" as const], likelySourceClasses: ["PRIMARY_INSTITUTIONAL" as const], expectedAuthorities: ["Institutional archive"], languages: ["en"], geography: ["Earth"], contested: false, dateCritical: true, priority, state: "UNRESEARCHED" as const });
const map = buildResearchMap(TEST_CONTEXT, scope, { version: 1, phases, dimensions, entities: [], questions: [question("q-foundation-tech", "phase-foundation", "dimension-tech"), question("q-expansion-tech", "phase-expansion", "dimension-tech"), question("q-current-society", "phase-current", "dimension-society")], terminology: [], knownUncertainty: [] });

function claim(id: string, questionId: string, year: number): AtomicClaimVersion {
  return buildAtomicClaimVersion(TEST_CONTEXT, { claimId: deterministicUuid("coverage-test-claim", id), scopeContractId: scope.scopeContractId, subject: { kind: "EVENT", id: null, label: `Development ${year}` }, predicate: "OCCURRENCE", object: { kind: "TEXT", id: null, value: `occurred in ${year}` }, normalizedAssertion: `Development ${year} occurred`, claimType: "OCCURRENCE", risk: "ROUTINE", temporal: { start: date(year), end: null }, candidateEventClusterId: `cluster-${year}`, locationEntityIds: [], qualifiers: [{ key: "researchQuestionId", value: questionId }], extractedFromSnapshotId: `snapshot-${year}`, extractedFromSegmentIds: [`segment-${year}`], conflictState: "NONE", validationState: "STRUCTURALLY_VALID", evidenceVerdictId: null, supersedesClaimVersionId: null });
}

function verdict(value: AtomicClaimVersion, state: "SUPPORTED" | "INSUFFICIENT" = "SUPPORTED"): ClaimAuthorityVerdict {
  const id = contentAddressedId("claim-verdict", { claimVersionId: value.claimVersionId, state });
  return parseSealedArtifact(claimAuthorityVerdictSchema, { ...immutableEnvelope(TEST_CONTEXT, id), artifactId: id, claimAuthorityVerdictId: id, claimVersionId: value.claimVersionId, evidenceSetHash: "a".repeat(64), risk: value.risk, verdict: state, reasonCodes: state === "SUPPORTED" ? ["DEFINITIVE_PRIMARY"] : ["MISSING_EVIDENCE"], qualifyingText: null, acceptedEvidenceEdgeIds: [], rejectedEvidenceEdgeIds: [], independenceGroupCount: state === "SUPPORTED" ? 1 : 0, definitivePrimary: state === "SUPPORTED", deterministicEvaluator: true });
}

function event(value: AtomicClaimVersion, year: number, semanticClass: "EVENT" | "CONTEXT" = "EVENT"): CanonicalEventVersion {
  return buildCanonicalEventVersion(TEST_CONTEXT, { version: 1, scopeContractId: scope.scopeContractId, canonicalTitle: `Development ${year}`, semanticClass, eventSubtype: semanticClass === "EVENT" ? "OCCURRENCE" : null, temporal: { start: date(year), end: null, uncertainty: null }, actionKey: `development occurred ${year}`, primaryEntityKeys: ["entity-subject"], locationKeys: [], coreClaimVersionIds: [value.claimVersionId], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE", canonicalizationState: semanticClass === "EVENT" ? "RESOLVED" : "INELIGIBLE", parentEventId: null, supersedesEventVersionId: null });
}

function audit(claims: AtomicClaimVersion[], verdicts: ClaimAuthorityVerdict[], events: CanonicalEventVersion[], conflicts: ClaimConflictSet[] = [], topicScope = scope) {
  return auditKnowledgeCoverage({ context: TEST_CONTEXT, stage: "INITIAL", scope: topicScope, researchMap: map, sourceKnowledgeRunIds: ["source-run"], claims, authorityVerdicts: verdicts, conflicts, events });
}

test("adequate multi-phase knowledge passes without equal-time quotas", () => {
  const claims = [claim("claim-1989", "q-foundation-tech", 1989), claim("claim-2010", "q-expansion-tech", 2010), claim("claim-2024", "q-current-society", 2024)];
  const result = audit(claims, claims.map((item) => verdict(item)), claims.map((item) => event(item, item.temporal!.start.year)));
  assert.equal(result.verdict, "SUFFICIENT");
  assert.equal(result.ongoingFreshness, "CURRENT_LOCKED_PHASE_REPRESENTED");
});

test("missing and weak material phases are distinct and create locked gap tasks", () => {
  const foundation = claim("claim-foundation", "q-foundation-tech", 1989);
  const expansion = claim("claim-expansion", "q-expansion-tech", 2010);
  const result = audit([foundation, expansion], [verdict(foundation), verdict(expansion)], [event(foundation, 1989)]);
  assert.equal(result.cells.find((cell) => cell.lockedRefId === "phase-expansion")?.state, "WEAK");
  assert.equal(result.cells.find((cell) => cell.lockedRefId === "phase-current")?.state, "MISSING");
  const plan = planGapDirectedCompletion({ context: TEST_CONTEXT, scope, researchMap: map, audit: result, originalKnowledgeRunId: "source-run" });
  assert.ok(plan.tasks.some((task) => task.phaseIds.includes("phase-expansion")));
  assert.ok(plan.tasks.some((task) => task.phaseIds.includes("phase-current")));
});

test("non-material empty cells do not block coverage", () => {
  const claims = [claim("claim-1988", "q-foundation-tech", 1988), claim("claim-2008", "q-expansion-tech", 2008), claim("claim-2023", "q-current-society", 2023)];
  const result = audit(claims, claims.map((item) => verdict(item)), claims.map((item) => event(item, item.temporal!.start.year)));
  assert.equal(result.cells.find((cell) => cell.lockedRefId === "phase-optional")?.state, "NOT_APPLICABLE");
  assert.equal(result.verdict, "SUFFICIENT");
});

test("ongoing staleness follows the latest locked phase while closed topics have no recency gate", () => {
  const claims = [claim("claim-1987", "q-foundation-tech", 1987), claim("claim-2009", "q-expansion-tech", 2009)];
  const stale = audit(claims, claims.map((item) => verdict(item)), claims.map((item) => event(item, item.temporal!.start.year)));
  assert.equal(stale.ongoingFreshness, "STALE_LOCKED_PHASE");
  assert.ok(stale.gaps.some((gap) => gap.code === "STALE_ONGOING_SCOPE"));
  const closed = scopeFixture({ title: scope.title, expectedPhases: scope.expectedPhases, requiredDimensions: scope.requiredDimensions, chronologyStart: date(1980), chronologyEnd: date(2026), topicClass: "CLOSED_EPISODE", ongoingAsOf: null });
  const closedAudit = audit(claims, claims.map((item) => verdict(item)), claims.map((item) => event(item, item.temporal!.start.year)), [], closed);
  assert.equal(closedAudit.ongoingFreshness, "NOT_APPLICABLE");
});

test("phase and dimension gaps create bounded, topic-derived questions without milestones", () => {
  const foundation = claim("claim-only-foundation", "q-foundation-tech", 1989);
  const result = audit([foundation], [verdict(foundation)], [event(foundation, 1989)]);
  const plan = planGapDirectedCompletion({ context: TEST_CONTEXT, scope, researchMap: map, audit: result, originalKnowledgeRunId: "source-run" });
  assert.ok(plan.tasks.length <= DEFAULT_COMPLETION_BUDGET.maximumGapQuestions);
  assert.ok(plan.tasks.some((task) => task.dimensionIds.includes("dimension-society")));
  assert.ok(plan.tasks.every((task) => task.providerQuery.includes(scope.title)));
  assert.ok(plan.tasks.every((task) => !/iphone|mosaic|social network/iu.test(task.providerQuery)));
});

test("completion budget exhaustion is explicit and immutable lineage is preserved", () => {
  const foundation = claim("claim-budget", "q-foundation-tech", 1989);
  const result = audit([foundation], [verdict(foundation)], [event(foundation, 1989)]);
  const plan = planGapDirectedCompletion({ context: TEST_CONTEXT, scope, researchMap: map, audit: result, originalKnowledgeRunId: "source-run", budget: { ...DEFAULT_COMPLETION_BUDGET, maximumGapQuestions: 1, maximumGroundingCalls: 1 } });
  assert.equal(plan.tasks.length, 1);
  assert.ok(plan.unplannedMaterialGapIds.length > 0);
  const revision = buildCompletionResearchMap({ context: TEST_CONTEXT, scope, parent: map, plan });
  assert.equal(revision.parentArtifactId, map.researchMapId);
  assert.equal(map.parentArtifactId, null);
  assert.equal(revision.version, 2);
});

test("re-audit passes after sufficient new knowledge and fails when a material gap remains", () => {
  const initialClaims = [claim("claim-i", "q-foundation-tech", 1989)];
  const added = [claim("claim-a", "q-expansion-tech", 2008), claim("claim-c", "q-current-society", 2024)];
  const all = [...initialClaims, ...added];
  const pass = auditKnowledgeCoverage({ context: TEST_CONTEXT, stage: "FINAL", scope, researchMap: map, sourceKnowledgeRunIds: ["source-run", "completion-run"], claims: all, authorityVerdicts: all.map((item) => verdict(item)), conflicts: [], events: all.map((item) => event(item, item.temporal!.start.year)) });
  assert.equal(pass.verdict, "SUFFICIENT");
  const fail = auditKnowledgeCoverage({ context: TEST_CONTEXT, stage: "FINAL", scope, researchMap: map, sourceKnowledgeRunIds: ["source-run", "completion-run"], claims: initialClaims, authorityVerdicts: initialClaims.map((item) => verdict(item)), conflicts: [], events: initialClaims.map((item) => event(item, 1989)) });
  assert.equal(fail.verdict, "KNOWLEDGE_COVERAGE_INSUFFICIENT");
});

test("non-events never satisfy chronology and material conflicts remain blocked", () => {
  const current = claim("claim-conflicted", "q-current-society", 2024);
  const competing = claim("claim-competing", "q-current-society", 2025);
  const conflictId = contentAddressedId("conflict", current.claimVersionId);
  const conflict = parseSealedArtifact(claimConflictSetSchema, { ...immutableEnvelope(TEST_CONTEXT, conflictId), artifactId: conflictId, conflictSetId: conflictId, conflictKey: "b".repeat(64), claimVersionIds: [current.claimVersionId, competing.claimVersionId], evidenceEdgeIds: ["edge-current", "edge-competing"], state: "UNRESOLVED", material: true, resolutionReason: null, resolutionEvidenceSegmentIds: [], blocksPass: true });
  const result = audit([current, competing], [verdict(current), verdict(competing)], [event(current, 2024, "CONTEXT")], [conflict]);
  assert.equal(result.cells.find((cell) => cell.lockedRefId === "phase-current")?.state, "BLOCKED");
  assert.equal(result.verdict, "KNOWLEDGE_COVERAGE_INSUFFICIENT");
});

test("completion event reuse preserves only the newest immutable canonical version", () => {
  const baseClaim = claim("claim-dedup", "q-foundation-tech", 1989);
  const original = event(baseClaim, 1989);
  const successor = buildCanonicalEventVersion({ ...TEST_CONTEXT, runId: "completion-run", createdAt: "2026-09-06T01:00:00.000Z" }, { candidateEventId: original.candidateEventId, canonicalEventId: original.canonicalEventId, version: 2, scopeContractId: original.scopeContractId, canonicalTitle: original.canonicalTitle, semanticClass: "EVENT", eventSubtype: original.eventSubtype, temporal: original.temporal, actionKey: original.actionKey, primaryEntityKeys: original.primaryEntityKeys, locationKeys: original.locationKeys, coreClaimVersionIds: original.coreClaimVersionIds, supportingClaimVersionIds: [], authorityState: original.authorityState, canonicalizationState: "RESOLVED", parentEventId: null, supersedesEventVersionId: original.eventVersionId });
  assert.deepEqual(mergeKnowledgeEventVersions([original, successor]).map((item) => item.eventVersionId), [successor.eventVersionId]);
});

test("coverage audit and gap plan reruns receive execution-scoped identities without colliding", () => {
  const foundation = claim("claim-identity", "q-foundation-tech", 1989);
  const input = { stage: "INITIAL" as const, scope, researchMap: map, sourceKnowledgeRunIds: ["source-run"], claims: [foundation], authorityVerdicts: [verdict(foundation)], conflicts: [], events: [event(foundation, 1989)] };
  const firstAudit = auditKnowledgeCoverage({ context: TEST_CONTEXT, ...input });
  const retryContext = { ...TEST_CONTEXT, runId: "coverage-retry-run", createdAt: "2026-09-07T00:00:00.000Z" };
  const secondAudit = auditKnowledgeCoverage({ context: retryContext, ...input });
  assert.notEqual(secondAudit.coverageAuditId, firstAudit.coverageAuditId);
  assert.notEqual(secondAudit.payloadHash, firstAudit.payloadHash);
  const firstPlan = planGapDirectedCompletion({ context: TEST_CONTEXT, scope, researchMap: map, audit: firstAudit, originalKnowledgeRunId: "source-run" });
  const secondPlan = planGapDirectedCompletion({ context: retryContext, scope, researchMap: map, audit: secondAudit, originalKnowledgeRunId: "source-run" });
  assert.notEqual(secondPlan.completionPlanId, firstPlan.completionPlanId);
});

test("final coverage audit and completed knowledge result bind exact execution provenance", () => {
  const values = [claim("claim-final-foundation", "q-foundation-tech", 1989), claim("claim-final-expansion", "q-expansion-tech", 2010), claim("claim-final-current", "q-current-society", 2024)];
  const auditInput = { stage: "FINAL" as const, scope, researchMap: map, sourceKnowledgeRunIds: ["source-run", "completion-run"], claims: values, authorityVerdicts: values.map((item) => verdict(item)), conflicts: [], events: values.map((item) => event(item, item.temporal!.start.year)) };
  const firstAudit = auditKnowledgeCoverage({ context: TEST_CONTEXT, ...auditInput });
  const secondContext = { ...TEST_CONTEXT, runId: "coverage-final-retry", createdAt: "2026-09-07T00:00:00.000Z" };
  const secondAudit = auditKnowledgeCoverage({ context: secondContext, ...auditInput });
  assert.notEqual(secondAudit.coverageAuditId, firstAudit.coverageAuditId);
  const resultPayload = { completionPlanId: "completion-plan", initialCoverageAuditId: "initial-audit", finalCoverageAuditId: firstAudit.coverageAuditId, acquisitionRunId: "completion-run", originalKnowledgeRunId: "source-run", newClaimVersionIds: [], newEventVersionIds: [], reusedEventVersionIds: [], unresolvedGapIds: [], budgetConsumed: { rounds: 1 as const, groundingCalls: 1, providerQueries: 1, sourceDocuments: 1, claimExtractions: 1, atomicClaims: 1, writes: 1 }, timings: { initialKnowledgeReuseMs: 1, coverageAuditMs: firstAudit.auditMs, gapAcquisitionMs: 1, reAuditMs: 1 }, finalVerdict: firstAudit.verdict };
  assert.notEqual(buildKnowledgeCompletionResult(secondContext, resultPayload).completionResultId, buildKnowledgeCompletionResult(TEST_CONTEXT, resultPayload).completionResultId);
});
