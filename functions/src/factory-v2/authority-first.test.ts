import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CONTROLLED_RESEARCH_BUDGET,
  auditPerspective,
  authorizeEscalation,
  buildAuthorityResearchPlan,
  buildConfidenceVector,
  buildTopicAuthoritySet,
  claimAuthorityApplicability,
  registeredGroundingExpansionPublishers,
  registryCapability
} from "./authority-first";
import { bootstrapPublisherRegistry } from "./authority";
import { buildResearchMap } from "./contracts/builders";
import type { PublisherAuthorityVersion, TopicAuthorityProposal } from "./contracts";
import { TEST_CONTEXT, scopeFixture } from "./test-fixtures";

const scope = scopeFixture();
const map = buildResearchMap(TEST_CONTEXT, scope, {
  version: 1,
  phases: [
    { phaseId: "phase-launch", label: "launch", temporalRule: "Apollo 11 launch operations", required: true, rationale: "Launch begins the mission chronology." },
    { phaseId: "phase-return", label: "return", temporalRule: "Apollo 11 recovery operations", required: true, rationale: "Recovery closes the mission chronology." }
  ],
  dimensions: [
    { dimensionId: "dimension-operational", label: "operational", required: true, rationale: "Operational chronology is required." },
    { dimensionId: "dimension-political", label: "political interpretation", required: true, rationale: "The topic includes contested political interpretation." }
  ],
  entities: [],
  questions: [
    { questionId: "question-chronology", text: "What official records establish the mission chronology?", phaseIds: ["phase-launch", "phase-return"], dimensionIds: ["dimension-operational"], claimTypesExpected: ["OCCURRENCE", "DATE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["United States", "Moon"], contested: false, dateCritical: true, priority: "CRITICAL", state: "UNRESEARCHED" },
    { questionId: "question-interpretation", text: "How should the political meaning of Apollo 11 be interpreted?", phaseIds: ["phase-launch", "phase-return"], dimensionIds: ["dimension-political"], claimTypesExpected: ["INTERPRETATION", "CONSEQUENCE"], likelySourceClasses: ["SCHOLARLY_SECONDARY"], expectedAuthorities: ["Independent scholarship"], languages: ["en"], geography: ["International"], contested: true, dateCritical: false, priority: "CRITICAL", state: "UNRESEARCHED" }
  ],
  terminology: [],
  knownUncertainty: []
});
const publishers = bootstrapPublisherRegistry(TEST_CONTEXT);
const publisher = (name: string): PublisherAuthorityVersion => publishers.find((item) => item.canonicalName === name)!;

function proposal(name: string, overrides: Partial<TopicAuthorityProposal>): TopicAuthorityProposal {
  const selected = publisher(name);
  return {
    publisherVersionId: selected.publisherVersionId,
    researchQuestionIds: ["question-chronology"],
    roles: ["PRIMARY_RECORD"],
    claimTypes: ["OCCURRENCE", "DATE"],
    subjectRelationship: "SUBJECT_SELF",
    perspectiveTags: ["United States"],
    rationale: "Registered authority is applicable to the mapped Research Map requirement.",
    ...overrides
  };
}

function validProposals(): TopicAuthorityProposal[] {
  return [
    proposal("National Aeronautics and Space Administration", {}),
    proposal("BBC", { researchQuestionIds: ["question-interpretation"], roles: ["CORROBORATION", "INTERPRETATION"], claimTypes: ["INTERPRETATION", "CONSEQUENCE"], subjectRelationship: "INDEPENDENT", perspectiveTags: ["United Kingdom", "International"] }),
    proposal("Smithsonian National Air and Space Museum", { researchQuestionIds: ["question-interpretation"], roles: ["CORROBORATION", "INTERPRETATION"], claimTypes: ["INTERPRETATION", "CONSEQUENCE"], subjectRelationship: "INDEPENDENT", perspectiveTags: ["United States", "International"] }),
    proposal("Encyclopaedia Britannica", { researchQuestionIds: ["question-chronology", "question-interpretation"], roles: ["ORIENTATION"], claimTypes: ["OCCURRENCE", "DATE", "INTERPRETATION"], subjectRelationship: "INDEPENDENT", perspectiveTags: ["International"] })
  ];
}

test("controlled research budget freezes auditable bounds without opaque query semantics", () => {
  assert.deepEqual(DEFAULT_CONTROLLED_RESEARCH_BUDGET, {
    version: "controlled-research-budget.1",
    maximumControlledDiscoveryOperations: 25,
    maximumGapRepairOperations: 5,
    maximumGroundingEscalationCalls: 2,
    maximumDirectRetrievals: 40,
    maximumConcurrency: 3,
    maximumCompletionRounds: 1,
    maximumWholeRunSeconds: 1200,
    maximumGapRoundSeconds: 480
  });
});

test("registry capabilities derive official endpoints and institution families from the existing publisher registry", () => {
  const nasa = registryCapability(publisher("National Aeronautics and Space Administration"));
  assert.equal(nasa.authorityFamily, "PUBLIC_SCIENTIFIC_INSTITUTION");
  assert.deepEqual(nasa.officialEndpoints, ["https://nasa.gov/"]);
  assert.ok(nasa.discoveryMechanisms.includes("SITEMAP"));
  const wikipedia = registryCapability(publisher("Wikimedia Foundation"));
  assert.equal(wikipedia.authorityFamily, "EDITED_REFERENCE");
});

test("Topic Authority Set rejects unknown authorities and requires evidentiary coverage for every critical question", () => {
  assert.throws(() => buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: [{ ...validProposals()[0]!, publisherVersionId: "publisher-version-unknown" }] }), /NO_APPLICABLE_AUTHORITY/);
  assert.throws(() => buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: [validProposals()[0]!] }), /MISSING_CRITICAL_AUTHORITY_COVERAGE/);
});

test("bounded continuation authority sets require only the explicit completion questions", () => {
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: [validProposals()[0]!], requiredQuestionIds: ["question-chronology"] });
  assert.deepEqual(set.criticalQuestionIds, ["question-chronology"]);
  assert.deepEqual(set.contestedQuestionIds, []);
  assert.ok(set.bindings.every((binding) => binding.researchQuestionIds.every((id) => id === "question-chronology")));
});

test("Grounding expansion admits only newly surfaced verified registry publishers and preserves successor lineage", () => {
  const initial = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: [validProposals()[0]!], requiredQuestionIds: ["question-chronology"] });
  const candidates = registeredGroundingExpansionPublishers({
    set: initial,
    publishers,
    researchQuestionId: "question-chronology",
    references: [
      { url: "https://www.computerhistory.org/babbage/adalovelace/", domain: "computerhistory.org" },
      { url: "https://unregistered.example/history", domain: "unregistered.example" },
      { url: "https://www.nasa.gov/history/apollo-11/", domain: "nasa.gov" }
    ]
  });
  assert.deepEqual(candidates.map((candidate) => candidate.canonicalName), ["Computer History Museum"]);
  const successor = buildTopicAuthoritySet({
    context: TEST_CONTEXT,
    scope,
    researchMap: map,
    publishers,
    proposals: [validProposals()[0]!, proposal("Computer History Museum", { subjectRelationship: "INDEPENDENT" })],
    requiredQuestionIds: ["question-chronology"],
    parentTopicAuthoritySetId: initial.topicAuthoritySetId
  });
  assert.equal(successor.parentArtifactId, initial.topicAuthoritySetId);
  assert.equal(successor.bindings.length, 2);
});

test("AI cannot relabel a subject-associated authority as independent", () => {
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: [proposal("National Aeronautics and Space Administration", { subjectRelationship: "INDEPENDENT" }), ...validProposals().slice(1)] });
  assert.equal(set.bindings.find((binding) => binding.publisherVersionId === publisher("National Aeronautics and Space Administration").publisherVersionId)?.subjectRelationship, "SUBJECT_SELF");
});

test("contested routing rejects self-interested or single-group interpretation coverage", () => {
  assert.throws(() => buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: [validProposals()[0]!, validProposals()[1]!] }), /PERSPECTIVE_INDEPENDENCE_INSUFFICIENT/);
});

test("validated Topic Authority Set is immutable, registry-bound, diverse, and routine without manual selection", () => {
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: validProposals() });
  const retrySet = buildTopicAuthoritySet({ context: { ...TEST_CONTEXT, runId: "retry-run", createdAt: "2027-01-01T00:00:00.000Z" }, scope, researchMap: map, publishers, proposals: validProposals() });
  assert.deepEqual(retrySet, set);
  assert.equal(set.validationStatus, "VALIDATED");
  assert.equal(set.bindings.length, 4);
  assert.equal(set.criticalQuestionIds.length, 2);
  assert.equal(set.rejectedPublisherVersionIds.length, 0);
  assert.equal(new Set(set.bindings.map((binding) => binding.bindingId)).size, set.bindings.length);
  const plan = buildAuthorityResearchPlan({ context: TEST_CONTEXT, set, researchMap: map });
  assert.equal(plan.state, "AUTHORIZED");
  assert.ok(plan.operations.some((operation) => operation.layer === "ORIENTATION" && operation.mechanism === "DIRECT_URL"));
  assert.ok(plan.operations.some((operation) => operation.layer === "EVIDENTIARY_CORE" && operation.mechanism === "SITEMAP"));
  assert.deepEqual(plan.coveredCriticalQuestionIds, set.criticalQuestionIds);
});

test("claim-relative authority accepts NASA mission facts but not independent Space Race interpretation", () => {
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: validProposals() });
  const nasa = set.bindings.find((binding) => binding.publisherId === publisher("National Aeronautics and Space Administration").publisherId)!;
  assert.deepEqual(claimAuthorityApplicability({ binding: nasa, claimType: "DATE", risk: "MATERIAL" }), { eligible: true, independentlySufficient: true, reason: "SUBJECT_PRIMARY_RECORD" });
  assert.equal(claimAuthorityApplicability({ binding: nasa, claimType: "INTERPRETATION", risk: "INTERPRETIVE" }).eligible, false);
  const bbc = set.bindings.find((binding) => binding.publisherId === publisher("BBC").publisherId)!;
  assert.deepEqual(claimAuthorityApplicability({ binding: bbc, claimType: "INTERPRETATION", risk: "INTERPRETIVE" }), { eligible: true, independentlySufficient: true, reason: "CLAIM_RELATIVE_AUTHORITY_APPLIES" });
});

test("perspective audit enforces explicit non-scholarly requirements and deterministic independent scholarship", () => {
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: validProposals() });
  const insufficient = auditPerspective({ context: TEST_CONTEXT, set, requiredPerspectiveTags: ["International", "Soviet Union"], sensitive: false });
  assert.equal(insufficient.verdict, "INADEQUATE");
  assert.ok(insufficient.reasonCodes.includes("MISSING_REQUIRED_PERSPECTIVE"));
  const sufficient = auditPerspective({ context: TEST_CONTEXT, set, requiredPerspectiveTags: ["International", "United States"], sensitive: false });
  assert.equal(sufficient.verdict, "SUFFICIENT");
  const independentScholarship = auditPerspective({ context: TEST_CONTEXT, set, requiredPerspectiveTags: [], requiredPerspectiveRequirements: [{ kind: "INDEPENDENT_SCHOLARSHIP", label: "Seismological Researchers", rationale: "Independent scholarly interpretation is required for this contested claim." }], sensitive: false });
  assert.equal(independentScholarship.verdict, "SUFFICIENT");
  const subjectSelfOnly = { ...set, bindings: set.bindings.filter((binding) => binding.subjectRelationship !== "INDEPENDENT") };
  const selfInterested = auditPerspective({ context: TEST_CONTEXT, set: subjectSelfOnly, requiredPerspectiveTags: [], requiredPerspectiveRequirements: [{ kind: "INDEPENDENT_SCHOLARSHIP", label: "Seismological Researchers", rationale: "Independent scholarly interpretation is required for this contested claim." }], sensitive: false });
  assert.equal(selfInterested.verdict, "INADEQUATE");
  assert.ok(selfInterested.missingPerspectiveTags.includes("Independent scholarship"));
  assert.equal(selfInterested.onlySelfInterestedEvidence, true);
});

test("confidence vector deterministically produces PASS, QUALIFIED, REVIEW_REQUIRED, and FAIL", () => {
  const base = { context: TEST_CONTEXT, topicAuthoritySetId: "topic-authority-set-1", authorityApplicability: "PASS" as const, evidenceDirectness: "PASS" as const, independentCorroboration: "PASS" as const, perspectiveAdequacy: "PASS" as const, conflictStatus: "PASS" as const, coverageCompleteness: "PASS" as const, temporalPrecision: "PASS" as const, provenanceIntegrity: "PASS" as const, reasonCodes: ["ALL_REQUIRED_DIMENSIONS_PASS"] };
  assert.equal(buildConfidenceVector(base).verdict, "PASS");
  assert.equal(buildConfidenceVector({ ...base, conflictStatus: "QUALIFIED" }).verdict, "QUALIFIED");
  assert.equal(buildConfidenceVector({ ...base, perspectiveAdequacy: "REVIEW_REQUIRED" }).verdict, "REVIEW_REQUIRED");
  assert.equal(buildConfidenceVector({ ...base, coverageCompleteness: "FAIL" }).verdict, "FAIL");
});

test("Google Grounding escalation requires a demonstrated mapped-authority attempt and remaining budget", () => {
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: validProposals() });
  assert.throws(() => authorizeEscalation({ context: TEST_CONTEXT, set, researchQuestionIds: ["question-interpretation"], gapIds: ["gap-perspective"], reason: "PERSPECTIVE_GAP", mappedAuthorityOperationsAttempted: 0, gapOperationsConsumed: 0, allowedPurpose: "Locate a missing registered or independently verifiable perspective." }), /ESCALATION_REQUIRES_MAPPED_AUTHORITY_ATTEMPT/);
  const decision = authorizeEscalation({ context: TEST_CONTEXT, set, researchQuestionIds: ["question-interpretation"], gapIds: ["gap-perspective"], reason: "PERSPECTIVE_GAP", mappedAuthorityOperationsAttempted: 4, gapOperationsConsumed: 1, allowedPurpose: "Locate a missing registered or independently verifiable perspective." });
  assert.equal(decision.remainingGapOperations, 4);
  assert.equal(decision.state, "AUTHORIZED");
});
