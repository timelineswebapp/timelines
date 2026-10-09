import assert from "node:assert/strict";
import test from "node:test";
import { buildAtomicClaimVersion, buildCanonicalEventVersion, buildResearchMap, immutableEnvelope, parseSealedArtifact } from "./contracts/builders";
import { claimAuthorityVerdictSchema, claimConflictSetSchema, type AtomicClaimVersion, type CanonicalEventVersion, type ClaimAuthorityVerdict, type ClaimConflictSet, type SourceDocument, type SourceSnapshot, type TopicAuthoritySet } from "./contracts";
import { auditKnowledgeCoverage, buildCompletionResearchMap, buildGapObligations, buildKnowledgeCompletionResult, DEFAULT_COMPLETION_BUDGET, mergeKnowledgeEventVersions, planGapDirectedCompletion, sealNoCompletionRequired } from "./coverage";
import { contentAddressedId, deterministicUuid } from "./hashing";
import { date, scopeFixture, TEST_CONTEXT } from "./test-fixtures";

const AUTHORITY_LINEAGE = [{ topicAuthoritySetId: "topic-authority-set", routingObligationSetId: "routing-obligation-set", authorityResearchPlanId: "authority-research-plan", controlledResearchLedgerId: "controlled-research-ledger", perspectiveAuditId: "perspective-audit", confidenceVectorId: "confidence-vector" }];

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

const evidencePublisherId = "4f5e4c55-7c5f-4a40-b632-77b5f5dcd2f8";
const evidencePublisherVersionId = "evidence-publisher-version";
const evidenceSnapshotId = "evidence-source-snapshot";

function evidenceAuthoritySet(questionId: string, perspectiveTags: string[]): TopicAuthoritySet {
  return {
    topicAuthoritySetId: "evidence-authority-set",
    bindings: [{
      bindingId: "evidence-binding",
      publisherId: evidencePublisherId,
      publisherVersionId: evidencePublisherVersionId,
      researchQuestionIds: [questionId],
      roles: ["PERSPECTIVE_TESTIMONY"],
      claimTypes: ["OCCURRENCE"],
      subjectRelationship: "COMMUNITY_CUSTODIAN",
      perspectiveTags,
      routingObligationIds: [],
      rationale: "Test-only governed community authority.",
      authorityFamily: "COMMUNITY_CUSTODIAL",
      independenceGroupId: "community-independence-group",
      verifiedDomains: ["community.example"],
      languages: ["en"],
      geography: [],
      officialEndpoints: ["https://community.example/archive"],
      discoveryMechanisms: ["DIRECT_URL"],
      specialistCollectionProfiles: [],
      validationStatus: "ELIGIBLE"
    }]
  } as unknown as TopicAuthoritySet;
}

function acquiredEvidence(): { sourceDocuments: SourceDocument[]; sourceSnapshots: SourceSnapshot[] } {
  return {
    sourceDocuments: [{ publisherId: evidencePublisherId }] as SourceDocument[],
    sourceSnapshots: [{ sourceSnapshotId: evidenceSnapshotId, retrievedAt: "2026-09-06T00:00:00.000Z" }] as SourceSnapshot[]
  };
}

test("adequate multi-phase knowledge passes without equal-time quotas", () => {
  const claims = [claim("claim-1989", "q-foundation-tech", 1989), claim("claim-2010", "q-expansion-tech", 2010), claim("claim-2024", "q-current-society", 2024)];
  const result = audit(claims, claims.map((item) => verdict(item)), claims.map((item) => event(item, item.temporal!.start.year)));
  assert.equal(result.verdict, "SUFFICIENT");
  assert.equal(result.ongoingFreshness, "CURRENT_LOCKED_PHASE_REPRESENTED");
});

test("sufficient initial knowledge seals a zero-round completion plan without redundant research", () => {
  const claims = [claim("claim-1989-zero", "q-foundation-tech", 1989), claim("claim-2010-zero", "q-expansion-tech", 2010), claim("claim-2024-zero", "q-current-society", 2024)];
  const result = audit(claims, claims.map((item) => verdict(item)), claims.map((item) => event(item, item.temporal!.start.year)));
  const plan = sealNoCompletionRequired({ context: TEST_CONTEXT, scope, researchMap: map, audit: result });
  assert.equal(plan.round, 0);
  assert.deepEqual(plan.tasks, []);
  assert.throws(() => planGapDirectedCompletion({ context: TEST_CONTEXT, scope, researchMap: map, audit: result, originalKnowledgeRunId: "source-run" }), /cannot run when the initial audit is already sufficient/);
});

test("Gap Obligations are impossible before a material initial evidence deficiency", () => {
  const claims = [claim("claim-gap-zero-foundation", "q-foundation-tech", 1989), claim("claim-gap-zero-expansion", "q-expansion-tech", 2010), claim("claim-gap-zero-current", "q-current-society", 2024)];
  const result = audit(claims, claims.map((item) => verdict(item)), claims.map((item) => event(item, item.temporal!.start.year)));
  assert.equal(result.verdict, "SUFFICIENT");
  assert.deepEqual(buildGapObligations({ context: TEST_CONTEXT, scope, researchMap: map, audit: result, authoritySet: evidenceAuthoritySet("q-current-society", []), sourceSnapshots: acquiredEvidence().sourceSnapshots }), []);
});

test("missing acquired affected-community evidence creates a lineage-bearing Gap Obligation", () => {
  const perspectiveMap = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases,
    dimensions,
    entities: [],
    questions: map.questions.map((item) => item.questionId === "q-current-society" ? {
      ...item,
      historicalPerspectiveRequirements: [{ kind: "AFFECTED_COMMUNITY" as const, label: "Affected community", rationale: "The community directly experienced the material historical consequences." }]
    } : item),
    terminology: [],
    knownUncertainty: []
  });
  const claims = [claim("claim-gap-perspective-foundation", "q-foundation-tech", 1989), claim("claim-gap-perspective-expansion", "q-expansion-tech", 2010), claim("claim-gap-perspective-current", "q-current-society", 2024)];
  const evidence = acquiredEvidence();
  const result = auditKnowledgeCoverage({ context: TEST_CONTEXT, stage: "INITIAL", scope, researchMap: perspectiveMap, sourceKnowledgeRunIds: ["source-run"], claims, authorityVerdicts: claims.map((item) => verdict(item)), conflicts: [], events: claims.map((item) => event(item, item.temporal!.start.year)), ...evidence, authoritySet: evidenceAuthoritySet("q-current-society", ["Unrelated institutional record"]) });
  const perspectiveGap = result.gaps.find((gap) => gap.code === "MISSING_HISTORICAL_PERSPECTIVE");
  assert.ok(perspectiveGap);
  const obligations = buildGapObligations({ context: TEST_CONTEXT, scope, researchMap: perspectiveMap, audit: result, authoritySet: evidenceAuthoritySet("q-current-society", ["Unrelated institutional record"]), sourceSnapshots: evidence.sourceSnapshots });
  const obligation = obligations.find((item) => item.coverageGapIds.includes(perspectiveGap!.gapId));
  assert.ok(obligation);
  assert.deepEqual(obligation!.existingSourceSnapshotIds, [evidenceSnapshotId]);
  assert.ok(obligation!.existingSupportingClaimVersionIds.includes(claims[2]!.claimVersionId));
  assert.deepEqual(obligation!.historicalRequirements.map((item) => item.label), ["Affected community"]);
  const plan = planGapDirectedCompletion({ context: TEST_CONTEXT, scope, researchMap: perspectiveMap, audit: result, originalKnowledgeRunId: "source-run", gapObligations: obligations });
  assert.ok(plan.tasks.some((task) => task.gapObligationIds?.includes(obligation!.gapObligationId)));
  assert.ok(plan.tasks.flatMap((task) => task.gapObligationIds || []).every((id) => obligations.some((item) => item.gapObligationId === id)));
});

test("generic stakeholder evidence is audited after acquisition and gaps retain immutable completion lineage", () => {
  const stakeholderMap = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1, phases, dimensions, entities: [],
    questions: map.questions.map((item) => item.questionId === "q-current-society" ? {
      ...item,
      historicalPerspectiveRequirements: [{ kind: "STAKEHOLDER" as const, label: "Local planners and relief organizations", rationale: "These actors made the material recovery decisions." }]
    } : item),
    terminology: [], knownUncertainty: []
  });
  const claims = [claim("claim-stakeholder-foundation", "q-foundation-tech", 1989), claim("claim-stakeholder-expansion", "q-expansion-tech", 2010), claim("claim-stakeholder-current", "q-current-society", 2024)];
  const missing = auditKnowledgeCoverage({ context: TEST_CONTEXT, stage: "INITIAL", scope, researchMap: stakeholderMap, sourceKnowledgeRunIds: ["source-run"], claims, authorityVerdicts: claims.map((item) => verdict(item)), conflicts: [], events: claims.map((item) => event(item, item.temporal!.start.year)), authoritySet: evidenceAuthoritySet("q-current-society", []), sourceDocuments: [] });
  const gap = missing.gaps.find((item) => item.code === "MISSING_HISTORICAL_PERSPECTIVE");
  assert.ok(gap);
  const obligations = buildGapObligations({ context: TEST_CONTEXT, scope, researchMap: stakeholderMap, audit: missing, authoritySet: evidenceAuthoritySet("q-current-society", []), sourceSnapshots: [] });
  const obligation = obligations.find((item) => item.coverageGapIds.includes(gap!.gapId));
  assert.ok(obligation);
  assert.deepEqual(obligation!.historicalRequirements.map((item) => item.label), ["Local planners and relief organizations"]);
  const acquired = acquiredEvidence();
  const satisfied = auditKnowledgeCoverage({ context: TEST_CONTEXT, stage: "FINAL", scope, researchMap: stakeholderMap, sourceKnowledgeRunIds: ["source-run"], claims, authorityVerdicts: claims.map((item) => verdict(item)), conflicts: [], events: claims.map((item) => event(item, item.temporal!.start.year)), authoritySet: evidenceAuthoritySet("q-current-society", []), ...acquired });
  assert.equal(satisfied.gaps.some((item) => item.code === "MISSING_HISTORICAL_PERSPECTIVE"), false);
  assert.equal(satisfied.verdict, "SUFFICIENT");
});

test("acquired matching community evidence satisfies the historical perspective without a completion obligation", () => {
  const perspectiveMap = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases,
    dimensions,
    entities: [],
    questions: map.questions.map((item) => item.questionId === "q-current-society" ? {
      ...item,
      historicalPerspectiveRequirements: [{ kind: "AFFECTED_COMMUNITY" as const, label: "Affected community", rationale: "The community directly experienced the material historical consequences." }]
    } : item),
    terminology: [],
    knownUncertainty: []
  });
  const claims = [claim("claim-perspective-pass-foundation", "q-foundation-tech", 1989), claim("claim-perspective-pass-expansion", "q-expansion-tech", 2010), claim("claim-perspective-pass-current", "q-current-society", 2024)];
  const evidence = acquiredEvidence();
  const result = auditKnowledgeCoverage({ context: TEST_CONTEXT, stage: "INITIAL", scope, researchMap: perspectiveMap, sourceKnowledgeRunIds: ["source-run"], claims, authorityVerdicts: claims.map((item) => verdict(item)), conflicts: [], events: claims.map((item) => event(item, item.temporal!.start.year)), ...evidence, authoritySet: evidenceAuthoritySet("q-current-society", ["Affected community"]) });
  assert.equal(result.gaps.some((gap) => gap.code === "MISSING_HISTORICAL_PERSPECTIVE"), false);
  assert.equal(result.verdict, "SUFFICIENT");
  assert.deepEqual(buildGapObligations({ context: TEST_CONTEXT, scope, researchMap: perspectiveMap, audit: result, authoritySet: evidenceAuthoritySet("q-current-society", ["Affected community"]), sourceSnapshots: evidence.sourceSnapshots }), []);
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

test("out-of-scope dated claims cannot satisfy closed-episode coverage", () => {
  const closed = scopeFixture({ title: scope.title, expectedPhases: scope.expectedPhases, requiredDimensions: scope.requiredDimensions, chronologyStart: date(1980), chronologyEnd: date(2020), topicClass: "CLOSED_EPISODE", ongoingAsOf: null });
  const foundation = claim("claim-closed-foundation", "q-foundation-tech", 1989);
  const expansion = claim("claim-closed-expansion", "q-expansion-tech", 2010);
  const future = claim("claim-closed-future", "q-current-society", 2027);
  const result = auditKnowledgeCoverage({ context: TEST_CONTEXT, stage: "FINAL", scope: closed, researchMap: map, sourceKnowledgeRunIds: ["source-run"], claims: [foundation, expansion, future], authorityVerdicts: [foundation, expansion, future].map((item) => verdict(item)), conflicts: [], events: [event(foundation, 1989), event(expansion, 2010), event(future, 2027)] });
  assert.equal(result.cells.find((cell) => cell.lockedRefId === "dimension-society")?.state, "MISSING");
  assert.equal(result.verdict, "KNOWLEDGE_COVERAGE_INSUFFICIENT");
});

test("phase and dimension gaps create bounded research questions without software-authored search queries", () => {
  const foundation = claim("claim-only-foundation", "q-foundation-tech", 1989);
  const result = audit([foundation], [verdict(foundation)], [event(foundation, 1989)]);
  const plan = planGapDirectedCompletion({ context: TEST_CONTEXT, scope, researchMap: map, audit: result, originalKnowledgeRunId: "source-run" });
  assert.ok(plan.tasks.length <= DEFAULT_COMPLETION_BUDGET.maximumGapQuestions);
  assert.ok(plan.tasks.some((task) => task.dimensionIds.includes("dimension-society")));
  assert.ok(plan.tasks.every((task) => task.question.includes(scope.title)));
  assert.ok(plan.tasks.every((task) => !("providerQuery" in task)));
});

test("missing chronology reserves one bounded completion task without suppressing specific gap remediation", () => {
  const chronology = question("software-chronology-question-test", "phase-foundation", "dimension-tech");
  const chronologyMap = buildResearchMap(TEST_CONTEXT, scope, { version: 1, phases, dimensions, entities: [], questions: [...map.questions, chronology], terminology: [], knownUncertainty: [] });
  const foundation = claim("claim-chronology-reservation", "q-foundation-tech", 1989);
  const result = auditKnowledgeCoverage({ context: TEST_CONTEXT, stage: "INITIAL", scope, researchMap: chronologyMap, sourceKnowledgeRunIds: ["source-run"], claims: [foundation], authorityVerdicts: [verdict(foundation)], conflicts: [], events: [] });
  assert.ok(result.gaps.some((gap) => gap.code === "MISSING_CHRONOLOGY"));
  const plan = planGapDirectedCompletion({ context: TEST_CONTEXT, scope, researchMap: chronologyMap, audit: result, originalKnowledgeRunId: "source-run" });
  assert.ok(plan.tasks[0]!.questionIds.includes(chronology.questionId));
  const chronologyGapIds = result.gaps.filter((gap) => gap.code === "MISSING_CHRONOLOGY").map((gap) => gap.gapId);
  assert.ok(chronologyGapIds.every((gapId) => plan.tasks[0]!.gapIds.includes(gapId)));
  assert.ok(plan.tasks.some((task) => task.phaseIds.includes("phase-expansion")));
  assert.ok(plan.tasks.some((task) => task.phaseIds.includes("phase-current")));
  assert.ok(plan.tasks.length <= DEFAULT_COMPLETION_BUDGET.maximumGapQuestions);
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
  assert.equal(revision.questions.length, map.questions.length);
  assert.ok(plan.tasks[0]!.questionIds.every((id) => revision.questions.find((question) => question.questionId === id)?.priority === "CRITICAL"));
  assert.ok(revision.questions.every((question) => !question.questionId.startsWith("coverage-question-")));
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

test("coverage audit and gap plan converge across execution-only reruns", () => {
  const foundation = claim("claim-identity", "q-foundation-tech", 1989);
  const input = { stage: "INITIAL" as const, scope, researchMap: map, sourceKnowledgeRunIds: ["source-run"], claims: [foundation], authorityVerdicts: [verdict(foundation)], conflicts: [], events: [event(foundation, 1989)] };
  const firstAudit = auditKnowledgeCoverage({ context: TEST_CONTEXT, ...input });
  const retryContext = { ...TEST_CONTEXT, runId: "coverage-retry-run", createdAt: "2026-09-07T00:00:00.000Z" };
  const secondAudit = auditKnowledgeCoverage({ context: retryContext, ...input });
  assert.equal(secondAudit.coverageAuditId, firstAudit.coverageAuditId);
  assert.equal(secondAudit.payloadHash, firstAudit.payloadHash);
  const firstPlan = planGapDirectedCompletion({ context: TEST_CONTEXT, scope, researchMap: map, audit: firstAudit, originalKnowledgeRunId: "source-run" });
  const secondPlan = planGapDirectedCompletion({ context: retryContext, scope, researchMap: map, audit: secondAudit, originalKnowledgeRunId: "source-run" });
  assert.equal(secondPlan.completionPlanId, firstPlan.completionPlanId);
  assert.equal(secondPlan.payloadHash, firstPlan.payloadHash);
});

test("final coverage audit and completed knowledge set normalize membership across execution-only reruns", () => {
  const values = [claim("claim-final-foundation", "q-foundation-tech", 1989), claim("claim-final-expansion", "q-expansion-tech", 2010), claim("claim-final-current", "q-current-society", 2024)];
  const auditInput = { stage: "FINAL" as const, scope, researchMap: map, sourceKnowledgeRunIds: ["source-run", "completion-run"], claims: values, authorityVerdicts: values.map((item) => verdict(item)), conflicts: [], events: values.map((item) => event(item, item.temporal!.start.year)) };
  const firstAudit = auditKnowledgeCoverage({ context: TEST_CONTEXT, ...auditInput });
  const secondContext = { ...TEST_CONTEXT, runId: "coverage-final-retry", createdAt: "2026-09-07T00:00:00.000Z" };
  const secondAudit = auditKnowledgeCoverage({ context: secondContext, ...auditInput });
  assert.equal(secondAudit.coverageAuditId, firstAudit.coverageAuditId);
  const eventIds = auditInput.events.map((item) => item.eventVersionId);
  const claimIds = values.map((item) => item.claimVersionId);
  const verdictIds = auditInput.authorityVerdicts.map((item) => item.claimAuthorityVerdictId);
  const resultPayload = { authorityAcquisitionRounds: AUTHORITY_LINEAGE, completionPlanId: "completion-plan", initialCoverageAuditId: "initial-audit", initialCoverageAuditPayloadHash: "a".repeat(64), finalCoverageAuditId: firstAudit.coverageAuditId, finalCoverageAuditPayloadHash: firstAudit.payloadHash, scopeContractId: scope.scopeContractId, scopePayloadHash: scope.payloadHash, researchMapId: map.researchMapId, researchMapPayloadHash: map.payloadHash, candidateEventVersionIds: eventIds, candidateClaimVersionIds: claimIds, authorityVerdictIds: verdictIds, conflictSetIds: [], unresolvedGapIds: [], finalVerdict: firstAudit.verdict };
  const firstResult = buildKnowledgeCompletionResult(TEST_CONTEXT, resultPayload);
  const retryResult = buildKnowledgeCompletionResult(secondContext, { ...resultPayload, candidateEventVersionIds: [...eventIds].reverse(), candidateClaimVersionIds: [...claimIds].reverse(), authorityVerdictIds: [...verdictIds].reverse() });
  assert.equal(retryResult.completionResultId, firstResult.completionResultId);
  assert.equal(retryResult.payloadHash, firstResult.payloadHash);
});
