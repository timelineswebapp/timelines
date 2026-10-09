import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CONTROLLED_RESEARCH_BUDGET,
  auditPerspective,
  applicableSpecialistCollectionProfiles,
  authorizeEscalation,
  buildAuthorityResearchPlan,
  buildConfidenceVector,
  buildEligibleRoutingCandidates,
  buildRoutingObligationSet,
  buildTopicAuthoritySet,
  batchRoutingObligations,
  lockRoutingProposals,
  claimAuthorityApplicability,
  isInitialAuthorityRequiredQuestion,
  historicalJurisdictionCapacityCovers,
  ProtectedRepresentationAvailabilityError,
  registeredGroundingExpansionPublishers,
  registryCapability,
  unresolvedRoutingObligationIds
} from "./authority-first";
import { bootstrapPublisherRegistry } from "./authority";
import { buildResearchMap } from "./contracts/builders";
import type { PublisherAuthorityVersion, SpecialistCollectionProfile, TopicAuthorityProposal } from "./contracts";
import { TEST_CONTEXT, date, scopeFixture } from "./test-fixtures";

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
    routingObligationIds: [],
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

function collectionProfile(profileId: string, endpoint: string, contentTypes: string[]): SpecialistCollectionProfile {
  return {
    profileId, publisherVersionId: publisher("National Aeronautics and Space Administration").publisherVersionId,
    version: 1, policyVersion: "specialist-collection-profile.1", capabilityClass: "SCIENTIFIC_TECHNICAL_ARCHIVES",
    collectionScope: "Official records and technical archive collection.", endpoint,
    discoveryMechanisms: ["DIRECT_URL"], supportedQueryParameters: [], languages: ["en"], geography: ["United States"],
    historicalPeriods: ["modern"], contentTypes, accessLimitations: [],
    verificationProvenance: "Verified official collection endpoint.", effectiveAt: "2026-10-02T00:00:00.000Z"
  };
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

test("specialist registry profiles are immutable official collection capabilities, not topic facts", () => {
  const profiles = ["British Library", "Library of Congress", "Metropolitan Museum of Art", "Asian Art Museum of San Francisco"]
    .flatMap((name) => registryCapability(publisher(name)).specialistCollectionProfiles);
  assert.equal(profiles.length, 4);
  assert.ok(profiles.every((profile) => profile.policyVersion === "specialist-collection-profile.1" && profile.version === 1));
  assert.ok(profiles.every((profile) => new URL(profile.endpoint).protocol === "https:" && profile.verificationProvenance.startsWith("Official ")));
  assert.ok(profiles.every((profile) => !/gutenberg|printing press|ada lovelace|berlin blockade|san francisco earthquake/iu.test(JSON.stringify(profile))));
  assert.equal(new Set(profiles.map((profile) => profile.profileId)).size, profiles.length);
});

test("historical-jurisdiction records-holder capacity is explicit, bounded, and never inferred from present geography", () => {
  const garf = publisher("State Archive of the Russian Federation");
  const capacity = garf.historicalJurisdictionCapacities[0]!;
  assert.equal(garf.geographicScope.includes("Soviet Union"), false, "present Russian geography is not Soviet jurisdiction capacity");
  assert.equal(capacity.historicalJurisdiction, "Soviet Union");
  assert.ok(historicalJurisdictionCapacityCovers({ capacity, historicalJurisdiction: "Soviet Union", period: { startYear: 1948, endYear: 1949 }, authorityDomains: ["Soviet occupation administration in Germany"], roles: ["PRIMARY_RECORD"], subjectRelationship: "INDEPENDENT" }));
  assert.equal(historicalJurisdictionCapacityCovers({ capacity, historicalJurisdiction: "Russian Federation", period: { startYear: 1948, endYear: 1949 }, roles: ["PRIMARY_RECORD"], subjectRelationship: "INDEPENDENT" }), false, "a modern successor is not an automatic predecessor alias");
  assert.equal(historicalJurisdictionCapacityCovers({ capacity, historicalJurisdiction: "Soviet Union", period: { startYear: 1962, endYear: 1962 }, roles: ["PRIMARY_RECORD"], subjectRelationship: "INDEPENDENT" }), false, "period bounds are mandatory");
  assert.equal(historicalJurisdictionCapacityCovers({ capacity, historicalJurisdiction: "Soviet Union", period: { startYear: 1948, endYear: 1949 }, authorityDomains: ["unrelated spaceflight records"], roles: ["PRIMARY_RECORD"], subjectRelationship: "INDEPENDENT" }), false, "collection/domain bounds are mandatory");
  assert.equal(publisher("Library of Congress").historicalJurisdictionCapacities.length, 0, "international collection geography is not a named historical jurisdiction capacity");
  assert.equal(publisher("John F. Kennedy Presidential Library and Museum").historicalJurisdictionCapacities.length, 0, "an unrelated Cuban Missile Crisis scope cannot satisfy Berlin");
});

test("a governed records holder satisfies Berlin Soviet jurisdiction only through its selected bounded capacity and emits diagnostics otherwise", () => {
  const berlinScope = scopeFixture({
    title: "The Berlin Blockade and Airlift", subjectDefinition: "The Soviet blockade and Western airlift affecting Berlin from 1948 to 1949.",
    chronologyStart: date(1948, "DAY", 6, 24), chronologyEnd: date(1949, "DAY", 5, 12), contextBefore: date(1945), contextAfter: date(1950),
    spatialScope: { included: ["Berlin", "Soviet Occupation Zone"], excluded: [], boundaryRule: "Include directly material Soviet occupation administration." }
  });
  const berlinMap = buildResearchMap({ ...TEST_CONTEXT, topicId: "berlin-capacity-test" }, berlinScope, {
    version: 1, phases: [{ phaseId: "phase-blockade", label: "blockade", temporalRule: "Blockade and airlift period.", required: true, rationale: "The episode requires its central phase." }],
    dimensions: [{ dimensionId: "dimension-policy", label: "policy", required: true, rationale: "Political policy evidence is required." }], entities: [],
    questions: [{ questionId: "question-soviet-policy", text: "What Soviet occupation policy shaped the Berlin Blockade?", phaseIds: ["phase-blockade"], dimensionIds: ["dimension-policy"], claimTypesExpected: ["INSTITUTIONAL_ACTION"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["Soviet administrative records"], languages: ["ru", "en"], geography: ["Berlin"], historicalPerspectiveRequirements: [{ kind: "MATERIAL_JURISDICTION", label: "Soviet Union", rationale: "Soviet administrative records are materially required for this policy question." }], contested: false, dateCritical: false, priority: "CRITICAL", state: "UNRESEARCHED" }], terminology: [], knownUncertainty: []
  });
  const garf = publisher("State Archive of the Russian Federation");
  const capacityId = garf.historicalJurisdictionCapacities[0]!.capacityId;
  const base: TopicAuthorityProposal = { publisherVersionId: garf.publisherVersionId, researchQuestionIds: ["question-soviet-policy"], roles: ["PRIMARY_RECORD"], claimTypes: ["INSTITUTIONAL_ACTION"], subjectRelationship: "INDEPENDENT", perspectiveTags: ["Soviet administrative records"], routingObligationIds: [], rationale: "The registered SVAG collection is a bounded holder of Soviet occupation-administration records." };
  const set = buildTopicAuthoritySet({ context: { ...TEST_CONTEXT, topicId: "berlin-capacity-test" }, scope: berlinScope, researchMap: berlinMap, publishers, proposals: [{ ...base, historicalJurisdictionCapacityIds: [capacityId] }] });
  assert.deepEqual(set.bindings[0]!.historicalJurisdictionCapacityIds, [capacityId]);
  assert.throws(() => buildTopicAuthoritySet({ context: { ...TEST_CONTEXT, topicId: "berlin-capacity-test" }, scope: berlinScope, researchMap: berlinMap, publishers, proposals: [{ ...base, historicalJurisdictionCapacityIds: [] }] }), (error: unknown) => {
    assert.ok(error instanceof ProtectedRepresentationAvailabilityError);
    assert.equal(error.diagnostic.canonicalLabel, "Soviet Union");
    assert.equal(error.diagnostic.researchMapId, berlinMap.researchMapId);
    assert.equal(error.diagnostic.eligibleCandidates[0]!.rejectionReason, "NO_SELECTED_HISTORICAL_JURISDICTION_CAPACITY");
    assert.ok(error.diagnostic.requirementId.startsWith("perspective-requirement-"));
    return true;
  });
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

test("protected representation fails preflight when the bounded authority universe has no eligible family", () => {
  const protectedMap = {
    ...map,
    questions: map.questions.map((question) => question.questionId === "question-chronology" ? {
      ...question,
      historicalPerspectiveRequirements: [{ kind: "AFFECTED_COMMUNITY" as const, label: "Affected community", rationale: "The affected community's evidence is materially necessary for this protected representation." }]
    } : question)
  };
  assert.throws(
    () => buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: protectedMap, publishers, proposals: validProposals() }),
    /PROTECTED_REPRESENTATION_AVAILABILITY_INSUFFICIENT:question-chronology:AFFECTED_COMMUNITY/
  );
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

test("supporting historical perspectives do not require predictive route proof before acquisition", () => {
  const perspectiveBearingSupportingQuestion = {
    ...map.questions[0]!,
    questionId: "question-community",
    text: "How did the affected community experience the mission program?",
    priority: "IMPORTANT" as const,
    historicalPerspectiveRequirements: [{ kind: "AFFECTED_COMMUNITY" as const, label: "Affected local community", rationale: "The community directly experienced the program and its consequences." }]
  };
  const mapWithRequiredPerspective = { ...map, questions: [...map.questions, perspectiveBearingSupportingQuestion] };
  const set = buildTopicAuthoritySet({
    context: TEST_CONTEXT,
    scope,
    researchMap: mapWithRequiredPerspective,
    publishers,
    proposals: [...validProposals(), proposal("National Archives and Records Administration", {
      researchQuestionIds: ["question-community"],
      perspectiveTags: ["Affected local community"]
    })]
  });
  assert.equal(set.routingObligationSetId, null);
  assert.deepEqual(set.obligationRoutes, []);
  assert.equal(set.criticalQuestionIds.includes("question-community"), false);
});

test("initial authority planning includes contested questions but does not promote a supporting perspective to predictive routing", () => {
  const supportingQuestion = { ...map.questions[0]!, priority: "IMPORTANT" as const, contested: true, historicalPerspectiveRequirements: undefined };
  const londonRetrieval = { ...supportingQuestion, contested: false, geography: ["London"] };
  const globalRetrieval = { ...supportingQuestion, contested: false, geography: ["Global"] };
  assert.equal(isInitialAuthorityRequiredQuestion(supportingQuestion), true);
  assert.equal(isInitialAuthorityRequiredQuestion({ ...supportingQuestion, contested: false }), false);
  assert.equal(isInitialAuthorityRequiredQuestion(londonRetrieval), false);
  assert.equal(isInitialAuthorityRequiredQuestion(globalRetrieval), false);
});

test("immutable routing obligations preserve historical requirements without converting retrieval context into viewpoints", () => {
  const obligationQuestion = {
    ...map.questions[0]!,
    questionId: "question-obligations",
    geography: ["London", "Global"],
    historicalPerspectiveRequirements: [
      { kind: "STAKEHOLDER" as const, label: "Municipal responders", rationale: "They made and implemented the material emergency decisions." },
      { kind: "AFFECTED_COMMUNITY" as const, label: "Displaced residents", rationale: "They directly experienced the material displacement." },
      { kind: "INDEPENDENT_SCHOLARSHIP" as const, label: "Independent scholarship", rationale: "Independent interpretation is structurally required." }
    ]
  };
  const obligationMap = { ...map, questions: [obligationQuestion] };
  const obligations = buildRoutingObligationSet({ context: TEST_CONTEXT, scope, researchMap: obligationMap });
  const retry = buildRoutingObligationSet({ context: { ...TEST_CONTEXT, runId: "routing-retry" }, scope, researchMap: obligationMap });
  assert.deepEqual(retry, obligations);
  assert.deepEqual(obligations.obligations.map((item) => item.label).sort(), ["Displaced residents", "Municipal responders"]);
  assert.ok(obligations.obligations.every((item) => !["London", "Global", "Independent scholarship"].includes(item.label)));
  assert.ok(obligations.obligations.every((item) => item.routingObligationId && item.semanticIdentity && item.rationale));
});

test("routing candidate construction is registry-bound, deterministic, and batches only compatible obligations", () => {
  const routingQuestion = {
    ...map.questions[0]!, questionId: "question-compatible-routes", geography: ["London", "Global"], historicalPerspectiveRequirements: [
      { kind: "STAKEHOLDER" as const, label: "Mission operations", rationale: "Operations staff made material operational decisions." },
      { kind: "STAKEHOLDER" as const, label: "Mission engineering", rationale: "Engineering staff made material technical decisions." }
    ]
  };
  const obligationMap = { ...map, questions: [routingQuestion] };
  const obligations = buildRoutingObligationSet({ context: TEST_CONTEXT, scope, researchMap: obligationMap });
  const first = buildEligibleRoutingCandidates({ routingObligationSet: obligations, publishers });
  const second = buildEligibleRoutingCandidates({ routingObligationSet: obligations, publishers: [...publishers].reverse() });
  assert.deepEqual(first, second);
  assert.ok(first.every((candidate) => candidate.eligibleRoles.includes("PRIMARY_RECORD")));
  assert.ok(first.every((candidate) => candidate.authorityFamily !== "EDITED_REFERENCE"));
  assert.equal(batchRoutingObligations({ routingObligationSet: obligations, candidates: first }).length, 1);
  assert.throws(
    () => buildEligibleRoutingCandidates({ routingObligationSet: obligations, publishers: publishers.map((item) => ({ ...item, state: "RETIRED" as const })) }),
    /ROUTING_OBLIGATION_ZERO_ELIGIBLE_CANDIDATES/
  );
});

test("routing batching stays bounded for 3, 10, 25, and 50 compatible obligations", () => {
  const routingQuestion = {
    ...map.questions[0]!, questionId: "question-routing-scale", historicalPerspectiveRequirements: [
      { kind: "STAKEHOLDER" as const, label: "Mission operations", rationale: "Operations staff made material decisions." }
    ]
  };
  const obligationMap = { ...map, questions: [routingQuestion] };
  const locked = buildRoutingObligationSet({ context: TEST_CONTEXT, scope, researchMap: obligationMap });
  const candidate = buildEligibleRoutingCandidates({ routingObligationSet: locked, publishers })[0]!;
  for (const count of [3, 10, 25, 50]) {
    const obligations = Array.from({ length: count }, (_, index) => ({ ...locked.obligations[0]!, routingObligationId: `routing-obligation-scale-${index}`, semanticIdentity: `STAKEHOLDER:scale-${index}`, label: `Operations group ${index}` }));
    const candidates = obligations.map((obligation) => ({ ...candidate, routingObligationId: obligation.routingObligationId }));
    const startedAt = Date.now();
    const batches = batchRoutingObligations({ routingObligationSet: { ...locked, obligations }, candidates });
    assert.ok(Date.now() - startedAt < 1_000, `batching ${count} obligations must remain bounded`);
    assert.equal(batches.flat().length, count);
    assert.ok(batches.every((batch) => batch.length <= 8));
    assert.equal(batches.length, Math.ceil(count / 8));
  }
});

test("route locks preserve partial success and expose only missing obligations to repair", () => {
  const routingQuestion = {
    ...map.questions[0]!, questionId: "question-route-locks", historicalPerspectiveRequirements: [
      { kind: "STAKEHOLDER" as const, label: "Operations", rationale: "Operations personnel made material decisions." },
      { kind: "STAKEHOLDER" as const, label: "Engineering", rationale: "Engineering personnel made material decisions." }
    ]
  };
  const obligationMap = { ...map, questions: [routingQuestion] };
  const obligations = buildRoutingObligationSet({ context: TEST_CONTEXT, scope, researchMap: obligationMap });
  const candidates = buildEligibleRoutingCandidates({ routingObligationSet: obligations, publishers });
  const makeProposal = (obligationId: string): TopicAuthorityProposal => {
    const candidate = candidates.find((item) => item.routingObligationId === obligationId)!;
    return { publisherVersionId: candidate.publisherVersionId, researchQuestionIds: [candidate.researchQuestionId], roles: [candidate.eligibleRoles[0]!], claimTypes: ["OCCURRENCE"], subjectRelationship: candidate.subjectRelationship, perspectiveTags: ["locked"], routingObligationIds: [obligationId], rationale: "A deterministically eligible route is locked." };
  };
  const first = makeProposal(obligations.obligations[0]!.routingObligationId);
  const locked = lockRoutingProposals({ locked: [], proposals: [first], candidates });
  assert.deepEqual(unresolvedRoutingObligationIds({ routingObligationSet: obligations, locked }), [obligations.obligations[1]!.routingObligationId]);
  const completed = lockRoutingProposals({ locked, proposals: [first, makeProposal(obligations.obligations[1]!.routingObligationId)], candidates });
  assert.equal(completed.length, 2);
  assert.equal(completed.find((proposal) => proposal.routingObligationIds[0] === first.routingObligationIds[0])?.rationale, first.rationale);
  assert.deepEqual(unresolvedRoutingObligationIds({ routingObligationSet: obligations, locked: completed }), []);
  assert.throws(() => lockRoutingProposals({ locked: [], proposals: [{ ...first, roles: ["CORROBORATION"] }], candidates }), /ROUTING_LOCK_ROLE_OR_QUESTION_INVALID/);
});

test("Topic Authority Set does not turn a historical perspective into a predictive source route", () => {
  const obligationQuestion = {
    ...map.questions[0]!, questionId: "question-route", historicalPerspectiveRequirements: [
      { kind: "PARTY_PARTICIPANT" as const, label: "Party records", rationale: "A direct participant perspective is historically material." }
    ]
  };
  const obligationMap = { ...map, questions: [obligationQuestion] };
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: obligationMap, publishers, proposals: [proposal("National Archives and Records Administration", { researchQuestionIds: ["question-route"], subjectRelationship: "INDEPENDENT", roles: ["PRIMARY_RECORD"] })] });
  assert.equal(set.routingObligationSetId, null);
  assert.equal(set.obligationRoutes.length, 0);
  const plan = buildAuthorityResearchPlan({ context: TEST_CONTEXT, set, researchMap: obligationMap });
  assert.deepEqual(plan.coveredRoutingObligationIds, []);
  assert.ok(plan.operations.filter((operation) => operation.layer === "EVIDENTIARY_CORE").every((operation) => operation.routingObligationIds.length === 0));
});

test("retired route mappings cannot alter canonical authority-set semantics", () => {
  const communityQuestion = {
    ...map.questions[0]!, questionId: "question-community-route", historicalPerspectiveRequirements: [
      { kind: "CUSTODIAL_COMMUNITY" as const, label: "Community custodians", rationale: "Custodial interpretation is historically material." }
    ]
  };
  const obligationMap = { ...map, questions: [communityQuestion] };
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: obligationMap, publishers, proposals: [proposal("National Archives and Records Administration", { researchQuestionIds: ["question-community-route"], roles: ["PRIMARY_RECORD"], routingObligationIds: ["not-a-locked-obligation"] })] });
  assert.deepEqual(set.obligationRoutes, []);
  assert.deepEqual(set.bindings[0]?.routingObligationIds, []);
});

test("specialist collection selection is deterministic metadata matching, never array order", () => {
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: validProposals() });
  const nasa = set.bindings.find((binding) => binding.publisherId === publisher("National Aeronautics and Space Administration").publisherId)!;
  const profileA = collectionProfile("specialist-profile-a", "https://nasa.gov/collections/a", ["official records"]);
  const profileB = collectionProfile("specialist-profile-b", "https://nasa.gov/collections/b", ["official records"]);
  const binding = { ...nasa, specialistCollectionProfiles: [profileB, profileA] };
  assert.deepEqual(applicableSpecialistCollectionProfiles({ binding, researchMap: map }).map((profile) => profile.profileId), ["specialist-profile-a", "specialist-profile-b"]);
  const plan = buildAuthorityResearchPlan({ context: TEST_CONTEXT, researchMap: map, set: { ...set, bindings: set.bindings.map((candidate) => candidate.bindingId === binding.bindingId ? binding : candidate) } });
  const attempts = plan.operations.filter((operation) => operation.authorityBindingId === binding.bindingId).sort((left, right) => left.attemptOrder - right.attemptOrder);
  assert.deepEqual(attempts.map((operation) => operation.specialistCollectionProfileId), ["specialist-profile-a", "specialist-profile-b", null]);
  assert.deepEqual(attempts.map((operation) => operation.attemptOrder), [0, 1, 2]);
});

test("generic authority discovery remains the only plan when no registered specialist profile applies", () => {
  const set = buildTopicAuthoritySet({ context: TEST_CONTEXT, scope, researchMap: map, publishers, proposals: validProposals() });
  const nasa = set.bindings.find((binding) => binding.publisherId === publisher("National Aeronautics and Space Administration").publisherId)!;
  const unrelated = { ...collectionProfile("specialist-profile-unrelated", "https://nasa.gov/collections/unrelated", ["manuscript codices"]), collectionScope: "Papyri and codicology collection." };
  const plan = buildAuthorityResearchPlan({ context: TEST_CONTEXT, researchMap: map, set: { ...set, bindings: set.bindings.map((binding) => binding.bindingId === nasa.bindingId ? { ...binding, specialistCollectionProfiles: [unrelated] } : binding) } });
  const attempts = plan.operations.filter((operation) => operation.authorityBindingId === nasa.bindingId);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0]!.specialistCollectionProfileId, null);
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
