import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  assertScopeBinding,
  atomicityFindings,
  buildAtomicClaimVersion,
  buildCanonicalEntityVersion,
  buildCanonicalEventVersion,
  buildEvidenceSegment,
  buildQueryPlan,
  buildResearchMap,
  deduplicateQueries,
  immutableEnvelope,
  parseSealedArtifact,
  sameCanonicalEvent,
  temporalIntervalsCompatible
} from "./contracts/builders";
import { acquisitionDiscoverySchema } from "./contracts";
import { payloadHash, verifyPayloadHash } from "./hashing";
import { TEST_CONTEXT, date, scopeFixture } from "./test-fixtures";

test("Scope Contracts are strict, immutable, deterministically hashed, and reject silent reinterpretation", () => {
  const scope = scopeFixture();
  assert.equal(scope.executionMode, "SHADOW");
  assert.equal(scope.publicationEligible, false);
  assert.equal(verifyPayloadHash(scope), true);
  assert.equal(scope.payloadHash, scopeFixture().payloadHash);
  assert.throws(() => assertScopeBinding(scope, { scopeContractId: scope.scopeContractId, scopePayloadHash: "0".repeat(64) }), /reinterpret/);
  assert.throws(() => scopeFixture({ chronologyEnd: null }), z.ZodError);
});

test("Schema normalization happens before the persisted payload hash is sealed", () => {
  const artifactId = "discovery-normalization-regression";
  const discovery = parseSealedArtifact(acquisitionDiscoverySchema, {
    ...immutableEnvelope(TEST_CONTEXT, artifactId), artifactId, discoveryId: artifactId, acquisitionRunId: "acquisition-1", queryId: "query-1",
    providerQuery: "  Apollo 11 primary sources  ", providerReportedQueries: ["  Apollo records  "], responseBodyHash: "a".repeat(64),
    chunks: [{ chunkIndex: 0, url: "https://example.com/apollo", title: "  Mission record  ", domain: "  example.com  " }],
    supports: [{ supportIndex: 0, startIndex: 0, endIndex: 7, attributedText: "  Apollo  ", chunkIndices: [0] }], searchEntryPointPresent: true,
  });
  assert.equal(discovery.chunks[0]!.title, "Mission record");
  assert.equal(verifyPayloadHash(discovery), true);
});

test("Research Map validates every required phase and dimension against questions", () => {
  const scope = scopeFixture();
  assert.throws(() => buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases: [{ phaseId: "launch", label: "Launch", temporalRule: "Mission launch operations", required: true, rationale: "Launch opens the scoped mission." }],
    dimensions: [{ dimensionId: "science", label: "Science", required: true, rationale: "Scientific objectives are required." }],
    entities: [], questions: [], terminology: [], knownUncertainty: []
  }), z.ZodError);
  const map = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases: [{ phaseId: "launch", label: "Launch", temporalRule: "Mission launch operations", required: true, rationale: "Launch opens the scoped mission." }],
    dimensions: [{ dimensionId: "science", label: "Science", required: true, rationale: "Scientific objectives are required." }],
    entities: [],
    questions: [{ questionId: "q-launch", text: "When and how did Apollo 11 launch?", phaseIds: ["launch"], dimensionIds: ["science"], claimTypesExpected: ["DATE", "OCCURRENCE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["NASA mission record"], languages: ["en"], geography: ["United States"], contested: false, dateCritical: true, priority: "CRITICAL", state: "UNRESEARCHED" }],
    terminology: [], knownUncertainty: []
  });
  assert.equal(map.scopePayloadHash, scope.payloadHash);
  assert.equal(verifyPayloadHash(map), true);
});

test("Query planning deterministically normalizes, deduplicates, and enforces role budgets", () => {
  const scope = scopeFixture();
  const map = buildResearchMap(TEST_CONTEXT, scope, {
    version: 1,
    phases: [{ phaseId: "launch", label: "Launch", temporalRule: "Mission launch operations", required: true, rationale: "Launch opens the scoped mission." }],
    dimensions: [{ dimensionId: "science", label: "Science", required: true, rationale: "Scientific objectives are required." }],
    entities: [],
    questions: [{ questionId: "q-launch", text: "When and how did Apollo 11 launch?", phaseIds: ["launch"], dimensionIds: ["science"], claimTypesExpected: ["DATE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["United States"], contested: false, dateCritical: true, priority: "CRITICAL", state: "UNRESEARCHED" }],
    terminology: [], knownUncertainty: []
  });
  const common = { researchQuestionIds: ["q-launch"], role: "ORIENTATION" as const, intendedSourceClass: "PRIMARY_INSTITUTIONAL" as const, aliasesAndTerms: ["Apollo 11"], language: "en", geography: ["United States"], providerReportedQueries: [], budgetUnits: 1, resultArtifactIds: [] };
  assert.equal(deduplicateQueries([{ providerQuery: "Apollo  Apollo 11" }, { providerQuery: "apollo 11" }]).length, 1);
  const plan = buildQueryPlan(TEST_CONTEXT, scope, map, { budget: scope.researchBudget, queries: [{ queryId: "query-1", providerQuery: "Apollo  Apollo 11 NASA launch", ...common }] });
  assert.equal(plan.queries[0]!.providerQuery, "Apollo 11 NASA launch");
  assert.equal(verifyPayloadHash(plan), true);
});

test("Evidence segments bind exact text and stable offsets to one immutable snapshot", () => {
  const segment = buildEvidenceSegment(TEST_CONTEXT, { sourceSnapshotId: "snapshot-1", exactText: "Apollo 11 launched from Kennedy Space Center on July 16, 1969.", segmentType: "TEXT", startOffset: 100, endOffset: 165, page: null, section: "Mission", selector: null, extractionMethod: "SAFE_HTML_TEXT", sourceCompleteness: "FULL_SNAPSHOT" });
  assert.equal(segment.segmentHash.length, 64);
  assert.equal(verifyPayloadHash(segment), true);
});

test("Atomic claims reject compound evidentiary burdens and validate predicate object types", () => {
  assert.deepEqual(atomicityFindings("Apollo 11 launched on July 16 and transformed global culture."), ["COMPOUND_CONJUNCTION", "MULTIPLE_EVIDENTIARY_BURDENS"]);
  assert.throws(() => buildAtomicClaimVersion(TEST_CONTEXT, {
    scopeContractId: scopeFixture().scopeContractId,
    subject: { kind: "EVENT", id: null, label: "Apollo 11 launch" }, predicate: "OCCURRENCE", object: { kind: "TEXT", id: null, value: "launch occurred" },
    normalizedAssertion: "Apollo 11 launched on July 16 and transformed global culture.", claimType: "OCCURRENCE", risk: "MATERIAL", temporal: null,
    candidateEventClusterId: null, locationEntityIds: [], qualifiers: [], extractedFromSnapshotId: "snapshot-1", extractedFromSegmentIds: ["segment-1"], conflictState: "NONE", validationState: "STRUCTURALLY_VALID", evidenceVerdictId: null, supersedesClaimVersionId: null
  }), z.ZodError);
  const claim = buildAtomicClaimVersion(TEST_CONTEXT, {
    scopeContractId: scopeFixture().scopeContractId,
    subject: { kind: "EVENT", id: null, label: "Apollo 11 launch" }, predicate: "DATE", object: { kind: "DATE", id: null, value: date(1969, "DAY", 7, 16) },
    normalizedAssertion: "Apollo 11 launched July 16, 1969", claimType: "DATE", risk: "MATERIAL", temporal: null,
    candidateEventClusterId: null, locationEntityIds: [], qualifiers: [], extractedFromSnapshotId: "snapshot-1", extractedFromSegmentIds: ["segment-1"], conflictState: "NONE", validationState: "STRUCTURALLY_VALID", evidenceVerdictId: null, supersedesClaimVersionId: null
  });
  assert.equal(verifyPayloadHash(claim), true);
});

test("Entity identities use typed external IDs and remain stable across label revisions", () => {
  const base = { version: 1, entityType: "Person" as const, canonicalName: "Neil Armstrong", language: "en", externalIdentifiers: [{ scheme: "wikidata", value: "Q1615" }], activeTemporal: null, geographyKeys: ["United States"], state: "FACTORY_CANDIDATE" as const, resolutionState: "RESOLVED" as const, identityEvidenceSegmentIds: ["segment-1"], supersedesEntityVersionId: null };
  const left = buildCanonicalEntityVersion(TEST_CONTEXT, base);
  const right = buildCanonicalEntityVersion(TEST_CONTEXT, { ...base, version: 2, canonicalName: "Neil A. Armstrong", supersedesEntityVersionId: left.entityVersionId });
  assert.equal(left.entityId, right.entityId);
  assert.notEqual(left.entityVersionId, right.entityVersionId);
});

test("Temporal compatibility preserves coarse precision and same-day events require matching action identity", () => {
  assert.equal(temporalIntervalsCompatible(date(1969, "YEAR"), date(1969, "DAY", 7, 16)), true);
  const base = { version: 1, scopeContractId: scopeFixture().scopeContractId, canonicalTitle: "Apollo 11 launches", semanticClass: "EVENT" as const, eventSubtype: "OCCURRENCE" as const, temporal: { start: date(1969, "DAY", 7, 16), end: null, uncertainty: null }, actionKey: "launch", primaryEntityKeys: ["entity-apollo-11"], locationKeys: ["place-kennedy"], coreClaimVersionIds: ["claim-launch"], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE" as const, canonicalizationState: "RESOLVED" as const, parentEventId: null, supersedesEventVersionId: null };
  const launch = buildCanonicalEventVersion(TEST_CONTEXT, base);
  const otherLaunch = buildCanonicalEventVersion(TEST_CONTEXT, { ...base, canonicalTitle: "Launch of Apollo 11" });
  const briefing = buildCanonicalEventVersion(TEST_CONTEXT, { ...base, canonicalTitle: "Apollo 11 crew briefing", actionKey: "crew briefing" });
  assert.equal(sameCanonicalEvent(launch, otherLaunch), true);
  assert.equal(sameCanonicalEvent(launch, briefing), false);
  assert.notEqual(launch.eventIdentityKey, briefing.eventIdentityKey);
});

test("Non-event knowledge is preserved but structurally ineligible for canonical event identity", () => {
  const item = buildCanonicalEventVersion(TEST_CONTEXT, { version: 1, scopeContractId: scopeFixture().scopeContractId, canonicalTitle: "Apollo 11 remains culturally influential", semanticClass: "STATE_LEGACY", eventSubtype: null, temporal: { start: date(1969, "YEAR"), end: null, uncertainty: null }, actionKey: "continuing cultural influence", primaryEntityKeys: ["entity-apollo-11"], locationKeys: [], coreClaimVersionIds: ["claim-legacy"], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE", canonicalizationState: "INELIGIBLE", parentEventId: null, supersedesEventVersionId: null });
  assert.equal(item.canonicalEventId, null);
  assert.equal(payloadHash(item), item.payloadHash);
});
