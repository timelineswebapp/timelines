import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapPublisherRegistry } from "./authority";
import { auditPerspective, buildAuthorityResearchPlan, buildConfidenceVector, buildTopicAuthoritySet } from "./authority-first";
import { buildCanonicalEntityVersion, buildResearchMap } from "./contracts/builders";
import type { TopicAuthorityProposal } from "./contracts";
import { TEST_CONTEXT, scopeFixture } from "./test-fixtures";
import { confidenceRequiresAdditionalBlock, conflictConfidenceStatus, evidenceMentionsScopeEntity, independentCorroborationStatus, requiredPerspectiveRequirements, requiredPerspectiveTags, resolutionEntityContext, selectMostPreciseHistoricalDate, temporalPrecisionStatus } from "./orchestrator";

const publishers = bootstrapPublisherRegistry(TEST_CONTEXT);
const byName = (name: string) => publishers.find((publisher) => publisher.canonicalName === name)!;
const FIXTURES = [
  { kind: "bounded episode", title: "A bounded disaster episode", contested: false, perspectives: ["United States"] },
  { kind: "conflict", title: "A blockade and international conflict", contested: true, perspectives: ["Participant A", "Participant B"] },
  { kind: "biography", title: "A historical mathematician", contested: false, perspectives: ["United Kingdom"] },
  { kind: "technology", title: "A printing technology", contested: false, perspectives: ["International"] },
  { kind: "science", title: "A scientific discovery", contested: false, perspectives: ["International"] },
  { kind: "institution", title: "An international institution", contested: false, perspectives: ["International"] },
  { kind: "long-duration", title: "A multi-century cultural institution", contested: false, perspectives: ["International"] },
  { kind: "contested geopolitical", title: "A disputed geopolitical history", contested: true, perspectives: ["State A", "State B"] },
  { kind: "decolonization", title: "A decolonization history", contested: true, perspectives: ["Former colony", "Former colonial power"] },
  { kind: "obscure regional cultural", title: "A regional custodial art tradition", contested: true, perspectives: ["Community custodian", "Regional scholarship"] }
] as const;

function proposal(name: string, questionId: string, contested: boolean, perspectiveTags: readonly string[]): TopicAuthorityProposal {
  const publisher = byName(name);
  return {
    publisherVersionId: publisher.publisherVersionId,
    researchQuestionIds: [questionId],
    roles: contested ? ["CORROBORATION", "INTERPRETATION"] : ["PRIMARY_RECORD"],
    claimTypes: contested ? ["INTERPRETATION", "CONSEQUENCE"] : ["OCCURRENCE", "DATE"],
    subjectRelationship: "INDEPENDENT",
    perspectiveTags: [...perspectiveTags],
    routingObligationIds: [],
    rationale: `${publisher.canonicalName} is registered and mapped to this bounded fixture requirement.`
  };
}

test("heterogeneous Authority-First fixture corpus certifies routing, perspective, budgets, lineage, and confidence", () => {
  for (const [index, fixture] of FIXTURES.entries()) {
    const context = { ...TEST_CONTEXT, topicId: `fixture-topic-${index + 1}` };
    const scope = scopeFixture({ title: fixture.title, topicClass: fixture.kind === "long-duration" ? "LONG_DURATION" : "CLOSED_EPISODE" }, context);
    const questionId = `fixture-question-${index + 1}`;
    const map = buildResearchMap(context, scope, {
      version: 1,
      phases: [{ phaseId: "fixture-phase", label: "material chronology", temporalRule: "The fixture's bounded material chronology.", required: true, rationale: "Material chronology must be evidenced." }],
      dimensions: [{ dimensionId: "fixture-dimension", label: "historical development", required: true, rationale: "Historical development is material." }],
      entities: [],
      questions: [{ questionId, text: `What registered evidence establishes ${fixture.title}?`, phaseIds: ["fixture-phase"], dimensionIds: ["fixture-dimension"], claimTypesExpected: fixture.contested ? ["INTERPRETATION", "CONSEQUENCE"] : ["OCCURRENCE", "DATE"], likelySourceClasses: fixture.contested ? ["SCHOLARLY_SECONDARY"] : ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["Registered institutions"], languages: ["en"], geography: [...fixture.perspectives], contested: fixture.contested, dateCritical: !fixture.contested, priority: "CRITICAL", state: "UNRESEARCHED" }],
      terminology: [], knownUncertainty: []
    });
    const proposals = fixture.contested
      ? [proposal("BBC", questionId, true, fixture.perspectives), proposal("Smithsonian National Air and Space Museum", questionId, true, fixture.perspectives)]
      : [proposal("British Library", questionId, false, fixture.perspectives)];
    const set = buildTopicAuthoritySet({ context, scope, researchMap: map, publishers, proposals });
    const plan = buildAuthorityResearchPlan({ context, set, researchMap: map });
    const perspective = auditPerspective({ context, set, requiredPerspectiveTags: fixture.perspectives, sensitive: false });
    const confidence = buildConfidenceVector({ context, topicAuthoritySetId: set.topicAuthoritySetId, authorityApplicability: "PASS", evidenceDirectness: "PASS", independentCorroboration: "PASS", perspectiveAdequacy: perspective.verdict === "SUFFICIENT" ? "PASS" : "FAIL", conflictStatus: "PASS", coverageCompleteness: "PASS", temporalPrecision: "PASS", provenanceIntegrity: "PASS", reasonCodes: ["HETEROGENEOUS_FIXTURE_CERTIFIED"] });
    assert.equal(set.researchMapId, map.researchMapId, fixture.kind);
    assert.ok(plan.operations.length <= plan.budget.maximumControlledDiscoveryOperations, fixture.kind);
    assert.equal(perspective.verdict, "SUFFICIENT", fixture.kind);
    assert.equal(confidence.verdict, "PASS", fixture.kind);
  }
});

test("contested factual uncertainty requires independence without inventing a location perspective", () => {
  const scope = scopeFixture();
  const map = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases: [{ phaseId: "phase-event", label: "event", temporalRule: "The bounded event phase.", required: true, rationale: "The event is material." }],
    dimensions: [{ dimensionId: "dimension-measurement", label: "measurement", required: true, rationale: "Measurement is material." }],
    entities: [],
    questions: [{ questionId: "question-magnitude", text: "What was the independently estimated magnitude?", phaseIds: ["phase-event"], dimensionIds: ["dimension-measurement"], claimTypesExpected: ["QUANTITY"], likelySourceClasses: ["SCHOLARLY_SECONDARY"], expectedAuthorities: ["Independent scientific institutions"], languages: ["en"], geography: ["Northern California", "Stanford University"], contested: true, dateCritical: false, priority: "CRITICAL", state: "UNRESEARCHED" }],
    terminology: [], knownUncertainty: []
  });
  assert.deepEqual(requiredPerspectiveTags(map), []);
});

test("physical features do not become human perspective requirements for contested causal research", () => {
  const scope = scopeFixture();
  const map = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases: [{ phaseId: "phase-event", label: "event", temporalRule: "The bounded event phase.", required: true, rationale: "The event is material." }],
    dimensions: [{ dimensionId: "dimension-cause", label: "cause", required: true, rationale: "Causation is material." }],
    entities: [],
    questions: [{ questionId: "question-cause", text: "What fault movement caused the event?", phaseIds: ["phase-event"], dimensionIds: ["dimension-cause"], claimTypesExpected: ["CAUSATION"], likelySourceClasses: ["SCHOLARLY_SECONDARY"], expectedAuthorities: ["Independent scientific institutions"], languages: ["en"], geography: ["San Andreas Fault"], contested: true, dateCritical: false, priority: "CRITICAL", state: "UNRESEARCHED" }],
    terminology: [], knownUncertainty: []
  });
  assert.deepEqual(requiredPerspectiveTags(map), []);
});

test("a locality does not create a separate perspective obligation when its jurisdiction is explicit", () => {
  const scope = scopeFixture();
  const map = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases: [{ phaseId: "phase-life", label: "life", temporalRule: "The biographical period.", required: true, rationale: "The period is material." }],
    dimensions: [{ dimensionId: "dimension-work", label: "work", required: true, rationale: "The work is material." }],
    entities: [],
    questions: [{ questionId: "question-locality", text: "How is the work interpreted in its national context?", phaseIds: ["phase-life"], dimensionIds: ["dimension-work"], claimTypesExpected: ["INTERPRETATION"], likelySourceClasses: ["SCHOLARLY_SECONDARY"], expectedAuthorities: ["Independent scholarship"], languages: ["en"], geography: ["United Kingdom", "London", "England"], contested: true, dateCritical: false, priority: "IMPORTANT", state: "UNRESEARCHED" }],
    terminology: [], knownUncertainty: []
  });
  assert.deepEqual(requiredPerspectiveTags(map), []);
});

test("bounded completion perspective audit is limited to its explicit gap questions", () => {
  const scope = scopeFixture();
  const map = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases: [{ phaseId: "phase-life", label: "life", temporalRule: "The biographical period.", required: true, rationale: "The period is material." }],
    dimensions: [{ dimensionId: "dimension-work", label: "work", required: true, rationale: "The work is material." }],
    entities: [],
    questions: [
      { questionId: "question-gap", text: "What dated evidence establishes the publication?", phaseIds: ["phase-life"], dimensionIds: ["dimension-work"], claimTypesExpected: ["OCCURRENCE", "DATE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["Archives"], languages: ["en"], geography: ["United Kingdom"], contested: false, dateCritical: true, priority: "CRITICAL", state: "UNRESEARCHED" },
      { questionId: "question-interpretation", text: "How is the work interpreted across national traditions?", phaseIds: ["phase-life"], dimensionIds: ["dimension-work"], claimTypesExpected: ["INTERPRETATION"], likelySourceClasses: ["SCHOLARLY_SECONDARY"], expectedAuthorities: ["Independent scholarship"], languages: ["en"], geography: ["United Kingdom", "France"], historicalPerspectiveRequirements: [{ kind: "MATERIAL_JURISDICTION", label: "United Kingdom", rationale: "The dispute directly concerns British policy." }, { kind: "MATERIAL_JURISDICTION", label: "France", rationale: "The dispute directly concerns French policy." }], contested: true, dateCritical: false, priority: "IMPORTANT", state: "UNRESEARCHED" }
    ],
    terminology: [], knownUncertainty: []
  });
  assert.deepEqual(requiredPerspectiveTags(map), ["France", "United Kingdom"]);
  assert.deepEqual(requiredPerspectiveTags(map, ["question-gap"]), []);
});

test("explicit historical perspectives survive geography-only adversarial inputs", () => {
  const scope = scopeFixture();
  const map = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases: [{ phaseId: "phase-history", label: "history", temporalRule: "The locked historical period.", required: true, rationale: "This historical period is required." }],
    dimensions: [{ dimensionId: "dimension-perspective", label: "perspective", required: true, rationale: "This perspective dimension is required." }],
    entities: [],
    questions: [
      { questionId: "routine-biography", text: "How is a routine biography interpreted?", phaseIds: ["phase-history"], dimensionIds: ["dimension-perspective"], claimTypesExpected: ["INTERPRETATION"], likelySourceClasses: ["SCHOLARLY_SECONDARY"], expectedAuthorities: ["Biographers"], languages: ["en"], geography: ["London", "Global"], contested: true, dateCritical: false, priority: "IMPORTANT", state: "UNRESEARCHED" },
      { questionId: "geopolitical", text: "How did the parties contest the blockade?", phaseIds: ["phase-history"], dimensionIds: ["dimension-perspective"], claimTypesExpected: ["INTERPRETATION"], likelySourceClasses: ["SCHOLARLY_SECONDARY"], expectedAuthorities: ["Historians"], languages: ["en"], geography: ["Berlin"], historicalPerspectiveRequirements: [{ kind: "PARTY_PARTICIPANT", label: "Soviet perspective", rationale: "The Soviet Union was a direct party to the contested policy.", historicalActionBasis: "The Soviet government implemented and administered the blockade as a direct party to the contested policy." }, { kind: "MATERIAL_JURISDICTION", label: "Western Allied perspective", rationale: "The Western Allies were direct parties to the contested policy." }], contested: true, dateCritical: false, priority: "CRITICAL", state: "UNRESEARCHED" },
      { questionId: "colonial", text: "How was decolonization experienced locally?", phaseIds: ["phase-history"], dimensionIds: ["dimension-perspective"], claimTypesExpected: ["INTERPRETATION"], likelySourceClasses: ["SCHOLARLY_SECONDARY"], expectedAuthorities: ["Community historians"], languages: ["en"], geography: ["Global"], historicalPerspectiveRequirements: [{ kind: "AFFECTED_COMMUNITY", label: "Affected local community", rationale: "The population directly experienced colonial administration and transition." }, { kind: "INDEPENDENT_SCHOLARSHIP", label: "Postcolonial scholarship", rationale: "Independent historiography is required for contested colonial interpretation." }], contested: true, dateCritical: false, priority: "CRITICAL", state: "UNRESEARCHED" },
      { questionId: "custodial", text: "How should a community-held collection be interpreted?", phaseIds: ["phase-history"], dimensionIds: ["dimension-perspective"], claimTypesExpected: ["INTERPRETATION"], likelySourceClasses: ["SCHOLARLY_SECONDARY"], expectedAuthorities: ["Custodians"], languages: ["en"], geography: ["London"], historicalPerspectiveRequirements: [{ kind: "CUSTODIAL_COMMUNITY", label: "Community custodian", rationale: "The community holds the material and its transmission context." }], contested: true, dateCritical: false, priority: "CRITICAL", state: "UNRESEARCHED" }
    ], terminology: [], knownUncertainty: []
  });
  assert.deepEqual(requiredPerspectiveTags(map), ["Affected local community", "Community custodian", "Western Allied perspective", "Soviet perspective"]);
  assert.deepEqual(requiredPerspectiveRequirements(map).map((requirement) => requirement.label), ["Affected local community", "Community custodian", "Postcolonial scholarship", "Western Allied perspective", "Soviet perspective"]);
  assert.deepEqual(requiredPerspectiveTags(map, ["routine-biography"]), []);
  assert.deepEqual(requiredPerspectiveTags(map, ["custodial"]), ["Community custodian"]);
});

test("non-material unresolved conflicts qualify confidence without triggering a material block", () => {
  assert.equal(conflictConfidenceStatus([{ state: "UNRESOLVED", material: false }]), "QUALIFIED");
  assert.equal(conflictConfidenceStatus([{ state: "UNRESOLVED", material: true }]), "FAIL");
  assert.equal(conflictConfidenceStatus([{ state: "RESOLVED", material: true }]), "PASS");
});

test("independent corroboration is fail-closed for major claim risks, not routine contextual interpretations", () => {
  assert.equal(independentCorroborationStatus([{ independenceGroupCount: 1, risk: "ROUTINE" }]), "PASS");
  assert.equal(independentCorroborationStatus([{ independenceGroupCount: 1, risk: "MATERIAL" }]), "FAIL");
  assert.equal(independentCorroborationStatus([{ independenceGroupCount: 1, risk: "INTERPRETIVE" }]), "FAIL");
  assert.equal(independentCorroborationStatus([{ independenceGroupCount: 2, risk: "CONTESTED" }]), "PASS");
  assert.equal(independentCorroborationStatus([{ independenceGroupCount: 0, risk: "ROUTINE" }]), "QUALIFIED");
});

test("temporal precision is aggregate-safe for gap completion but fail-closed for initial acquisition", () => {
  assert.equal(temporalPrecisionStatus([], false), "FAIL");
  assert.equal(temporalPrecisionStatus([], true), "QUALIFIED");
  assert.equal(temporalPrecisionStatus([{ temporal: { start: { year: 1906, month: 4, day: 18, precision: "DAY", earliestYear: 1906, latestYear: 1906, label: "April 18, 1906" }, uncertainty: null } }], false), "PASS");
  assert.equal(temporalPrecisionStatus([{ temporal: { start: { year: 1906, month: null, day: null, precision: "APPROXIMATE", earliestYear: 1905, latestYear: 1907, label: "circa 1906" }, uncertainty: "Approximate." } }], false), "QUALIFIED");
});

test("missing-event confidence does not duplicate the sole completion-eligible blocker", () => {
  const temporalOnly = { verdict: "FAIL" as const, authorityApplicability: "PASS" as const, evidenceDirectness: "PASS" as const, independentCorroboration: "PASS" as const, perspectiveAdequacy: "PASS" as const, conflictStatus: "QUALIFIED" as const, provenanceIntegrity: "PASS" as const };
  assert.equal(confidenceRequiresAdditionalBlock(temporalOnly, ["NO_RESOLVED_EVENT_CANDIDATES"]), false);
  assert.equal(confidenceRequiresAdditionalBlock({ ...temporalOnly, provenanceIntegrity: "FAIL" }, ["NO_RESOLVED_EVENT_CANDIDATES"]), true);
  assert.equal(confidenceRequiresAdditionalBlock(temporalOnly, ["NO_SUPPORTED_CLAIMS", "NO_RESOLVED_EVENT_CANDIDATES"]), true);
  assert.equal(confidenceRequiresAdditionalBlock({ ...temporalOnly, verdict: "REVIEW_REQUIRED", perspectiveAdequacy: "REVIEW_REQUIRED" }, ["NO_RESOLVED_EVENT_CANDIDATES"]), false);
});

test("event resolution prefers the most precise supported temporal observation deterministically", () => {
  const year = { year: 1906, month: null, day: null, precision: "YEAR" as const, earliestYear: 1906, latestYear: 1906, label: "1906" };
  const day = { year: 1906, month: 4, day: 18, precision: "DAY" as const, earliestYear: 1906, latestYear: 1906, label: "April 18, 1906" };
  assert.equal(selectMostPreciseHistoricalDate([{ value: "year", date: year, stableId: "a" }, { value: "day", date: day, stableId: "b" }]), "day");
  assert.equal(selectMostPreciseHistoricalDate([{ value: "day", date: day, stableId: "b" }, { value: "year", date: year, stableId: "a" }]), "day");
});

test("event resolution accepts a substantive scope-entity mention without a historical-year qualifier", () => {
  assert.equal(evidenceMentionsScopeEntity("The San Francisco earthquake occurred on April 18, 1906.", "1906 San Francisco Earthquake"), true);
  assert.equal(evidenceMentionsScopeEntity("The Berlin blockade began in 1948.", "1948 Berlin Airlift"), false);
  assert.equal(evidenceMentionsScopeEntity("The earthquake occurred in 1906.", "1906 San Francisco Earthquake"), false);
  assert.equal(evidenceMentionsScopeEntity("The 1906 San Francisco earthquake occurred.", "1906 San Francisco Earthquake"), true);
});

test("completion event resolution reuses only resolved entities matching the locked scope", () => {
  const scope = scopeFixture();
  const reusable = buildCanonicalEntityVersion(TEST_CONTEXT, { version: 1, entityType: "Technology", canonicalName: "Apollo 11", language: "en", externalIdentifiers: [], activeTemporal: null, geographyKeys: [], state: "FACTORY_CANDIDATE", resolutionState: "RESOLVED", identityEvidenceSegmentIds: ["segment-initial"], supersedesEntityVersionId: null });
  const unrelated = buildCanonicalEntityVersion(TEST_CONTEXT, { version: 1, entityType: "Institution", canonicalName: "Unrelated Archive", language: "en", externalIdentifiers: [], activeTemporal: null, geographyKeys: [], state: "FACTORY_CANDIDATE", resolutionState: "RESOLVED", identityEvidenceSegmentIds: ["segment-unrelated"], supersedesEntityVersionId: null });
  assert.deepEqual(resolutionEntityContext(scope.centralEntities, [], [unrelated, reusable]).map((entity) => entity.entityVersionId), [reusable.entityVersionId]);
});
