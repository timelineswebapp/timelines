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
import { acquisitionDiscoverySchema, deadlineTerminalRecordSchema, hasDirectHistoricalActionBasis, researchMapSchema } from "./contracts";
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

test("deadline terminal evidence is sealed before strict validation", () => {
  const artifactId = "deadline-terminal-regression";
  const terminal = parseSealedArtifact(deadlineTerminalRecordSchema, {
    ...immutableEnvelope(TEST_CONTEXT, artifactId),
    deadlineTerminalRecordId: artifactId,
    failureRecordId: "failure-deadline-regression",
    terminalStage: "A3_CLAIMS",
    deadlineAt: "2026-09-22T00:20:00.000Z",
    elapsedMs: 1_200_000,
    lastCompletedOperation: "firestore:set-operation:A3#1",
    activeOperation: null,
    completedOperations: ["firestore:set-operation:A3#1"],
    timedOutOperations: [],
    lateCompletionsIgnored: [],
    shutdownGraceMs: 5_000,
    shutdownGraceOutcome: "SETTLED",
    controlledOperationCount: 1,
    directRetrievalAttempts: 1,
    retrievalSuccesses: 1,
    retrievalFailures: 0,
    sourceSnapshotIds: [],
    claimVersionIds: [],
    eventVersionIds: [],
    coverageState: "INCOMPLETE_DEADLINE_TERMINATED",
    perspectiveAuditId: null,
    confidenceVectorId: null,
    protectedStateParity: "PENDING_EXTERNAL_VERIFICATION"
  });
  assert.equal(verifyPayloadHash(terminal), true);
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

test("current Research Maps require direct historical action before creating a protected party requirement", () => {
  const scope = scopeFixture();
  const base = {
    version: 1,
    phases: [{ phaseId: "launch", label: "Launch", temporalRule: "Mission launch operations", required: true, rationale: "Launch opens the scoped mission." }],
    dimensions: [{ dimensionId: "science", label: "Science", required: true, rationale: "Scientific objectives are required." }],
    entities: [], terminology: [], knownUncertainty: []
  };
  const question = { questionId: "q-party", text: "What did the institution do during the event?", phaseIds: ["launch"], dimensionIds: ["science"], claimTypesExpected: ["OCCURRENCE"] as Array<"OCCURRENCE">, likelySourceClasses: ["PRIMARY_INSTITUTIONAL"] as Array<"PRIMARY_INSTITUTIONAL">, expectedAuthorities: ["Registered authority"], languages: ["en"], geography: ["United States"], contested: false, dateCritical: false, priority: "IMPORTANT" as const, state: "UNRESEARCHED" as const };
  assert.throws(() => buildResearchMap(TEST_CONTEXT, scope, { ...base, questions: [{ ...question, historicalPerspectiveRequirements: [{ kind: "PARTY_PARTICIPANT", label: "Scientific agency", rationale: "The agency documented the event and is technically authoritative.", historicalActionBasis: "The agency documented and investigated the event after it occurred." }] }] }), z.ZodError);
  const valid = buildResearchMap(TEST_CONTEXT, scope, { ...base, questions: [{ ...question, historicalPerspectiveRequirements: [{ kind: "PARTY_PARTICIPANT", label: "Emergency command", rationale: "The command made material response decisions during the event.", historicalActionBasis: "The emergency command directed operations and made material response decisions during the historical episode." }] }] });
  assert.equal(valid.questions[0]!.historicalPerspectiveRequirements?.[0]?.historicalActionBasis?.includes("directed operations"), true);
  assert.equal(hasDirectHistoricalActionBasis("The command deployed responders and carried out relief operations."), true);
  assert.equal(hasDirectHistoricalActionBasis("The archive preserved and interpreted later records."), false);
  const legacy = structuredClone(valid) as Record<string, unknown>;
  legacy.schemaVersion = "factory-v2-a.9";
  const legacyQuestions = legacy.questions as Array<Record<string, unknown>>;
  const legacyRequirements = legacyQuestions[0]!.historicalPerspectiveRequirements as Array<Record<string, unknown>>;
  delete legacyRequirements[0]!.historicalActionBasis;
  assert.doesNotThrow(() => researchMapSchema.parse(legacy), "sealed .9 maps remain explicitly supported historical artifacts");
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
  assert.deepEqual(atomicityFindings("Apollo 11 launched on July 16 and transformed global culture."), ["MULTIPLE_EVIDENTIARY_BURDENS"]);
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

test("Equivalent propositions retain one stable claim identity across wording and evidence sources", () => {
  const base = {
    scopeContractId: scopeFixture().scopeContractId,
    subject: { kind: "EVENT" as const, id: null, label: "Apollo 11 launch" }, predicate: "OCCURRENCE" as const, object: { kind: "TEXT" as const, id: null, value: "Apollo 11 launched" },
    claimType: "OCCURRENCE" as const, risk: "ROUTINE" as const, temporal: null, candidateEventClusterId: "apollo-11-launch", locationEntityIds: [], qualifiers: [], conflictState: "NONE" as const,
    validationState: "STRUCTURALLY_VALID" as const, evidenceVerdictId: null, supersedesClaimVersionId: null
  };
  const first = buildAtomicClaimVersion(TEST_CONTEXT, { ...base, normalizedAssertion: "Apollo 11 launched", extractedFromSnapshotId: "snapshot-1", extractedFromSegmentIds: ["segment-1"] });
  const second = buildAtomicClaimVersion(TEST_CONTEXT, { ...base, normalizedAssertion: "The Apollo 11 mission launched", extractedFromSnapshotId: "snapshot-2", extractedFromSegmentIds: ["segment-2"] });
  assert.equal(first.claimId, second.claimId);
  assert.notEqual(first.claimVersionId, second.claimVersionId);
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
