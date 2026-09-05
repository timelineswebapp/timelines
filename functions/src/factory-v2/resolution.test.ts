import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalEntityVersion, buildCanonicalEventVersion, immutableEnvelope, sealArtifact } from "./contracts/builders";
import { classifyKnowledgeReuse, createEventMergeSplitDecision, eventWithinLockedScope, resolveEntityCandidate, resolveEventCandidate } from "./resolution";
import type { EntityAlias } from "./contracts";
import { TEST_CONTEXT, date, scopeFixture } from "./test-fixtures";

function entity(name: string, externalValue: string, geography = "United States") {
  return buildCanonicalEntityVersion(TEST_CONTEXT, { version: 1, entityType: "Person", canonicalName: name, language: "en", externalIdentifiers: externalValue ? [{ scheme: "wikidata", value: externalValue }] : [], activeTemporal: null, geographyKeys: [geography], state: "FACTORY_CANDIDATE", resolutionState: "RESOLVED", identityEvidenceSegmentIds: ["segment-1"], supersedesEntityVersionId: null });
}

function alias(entityId: string, versionId: string, name: string): EntityAlias {
  const aliasId = `alias-${name.replace(/\s+/gu, "-").toLocaleLowerCase("en-US")}`;
  return sealArtifact({ ...immutableEnvelope(TEST_CONTEXT, aliasId), entityAliasId: aliasId, entityId, entityVersionId: versionId, entityType: "Person", alias: name, aliasKey: name.toLocaleLowerCase("en-US"), language: "en", script: "Latin", aliasType: "ALTERNATE" }) as EntityAlias;
}

const scope = scopeFixture();
const eventBase = { version: 1, scopeContractId: scope.scopeContractId, canonicalTitle: "Apollo 11 launches", semanticClass: "EVENT" as const, eventSubtype: "OCCURRENCE" as const, temporal: { start: date(1969, "DAY", 7, 16), end: null, uncertainty: null }, actionKey: "launch", primaryEntityKeys: ["entity-apollo-11"], locationKeys: ["place-kennedy"], coreClaimVersionIds: ["claim-launch"], supportingClaimVersionIds: [], authorityState: "FACTORY_CANDIDATE" as const, canonicalizationState: "RESOLVED" as const, parentEventId: null, supersedesEventVersionId: null };

test("Entity resolution uses exact typed external IDs before aliases or names", () => {
  const armstrong = entity("Neil Armstrong", "Q1615");
  const result = resolveEntityCandidate({ candidate: { entityType: "Person", canonicalName: "N. Armstrong", language: "en", externalIdentifiers: [{ scheme: "wikidata", value: "Q1615" }], geographyKeys: [] }, existing: [armstrong], aliases: [] });
  assert.equal(result.state, "REUSED");
  assert.equal(result.basis, "EXTERNAL_ID");
});

test("Multilingual aliases resolve typed identity while same-name ambiguity requires review", () => {
  const first = entity("John Smith", "Q1", "United States");
  const second = entity("John Smith", "Q2", "United Kingdom");
  const named = resolveEntityCandidate({ candidate: { entityType: "Person", canonicalName: "John Smith", language: "en", externalIdentifiers: [], geographyKeys: [] }, existing: [first, second], aliases: [] });
  assert.equal(named.state, "REVIEW_REQUIRED");
  const aliased = resolveEntityCandidate({ candidate: { entityType: "Person", canonicalName: "Commander Armstrong", language: "en", externalIdentifiers: [], geographyKeys: [] }, existing: [first], aliases: [alias(first.entityId, first.entityVersionId, "Commander Armstrong")] });
  assert.equal(aliased.state, "REUSED");
  assert.equal(aliased.basis, "ALIAS");
});

test("Event identity reuses exact matches and preserves same-day distinct actions", () => {
  const launch = buildCanonicalEventVersion(TEST_CONTEXT, eventBase);
  const exact = buildCanonicalEventVersion(TEST_CONTEXT, { ...eventBase, canonicalTitle: "Launch of Apollo 11" });
  const briefing = buildCanonicalEventVersion(TEST_CONTEXT, { ...eventBase, canonicalTitle: "Crew briefing", actionKey: "crew briefing" });
  assert.equal(resolveEventCandidate(exact, [launch]).state, "REUSED");
  assert.equal(resolveEventCandidate(briefing, [launch]).state, "NEW_CANDIDATE");
});

test("Title similarity never creates event identity and near matches route to adjudication", () => {
  const launch = buildCanonicalEventVersion(TEST_CONTEXT, eventBase);
  const possible = buildCanonicalEventVersion(TEST_CONTEXT, { ...eventBase, temporal: { start: { ...date(1969, "YEAR"), label: "1969" }, end: null, uncertainty: null } });
  assert.equal(resolveEventCandidate(possible, [launch]).state, "REVIEW_REQUIRED");
});

test("STATE_LEGACY, CONTEXT, and FUTURE are preserved but never chronology eligible", () => {
  for (const semanticClass of ["STATE_LEGACY", "CONTEXT", "FUTURE"] as const) {
    const item = buildCanonicalEventVersion(TEST_CONTEXT, { ...eventBase, canonicalTitle: `${semanticClass} item`, semanticClass, eventSubtype: null, canonicalizationState: "INELIGIBLE" });
    assert.equal(resolveEventCandidate(item, []).state, "NON_EVENT_PRESERVED");
    assert.equal(eventWithinLockedScope(scope, item), false);
  }
});

test("Closed scope requires the entire supported interval and does not accept mere overlap", () => {
  const inside = buildCanonicalEventVersion(TEST_CONTEXT, eventBase);
  const outside = buildCanonicalEventVersion(TEST_CONTEXT, { ...eventBase, temporal: { start: date(1969, "YEAR"), end: null, uncertainty: null } });
  assert.equal(eventWithinLockedScope(scope, inside), true);
  assert.equal(eventWithinLockedScope(scope, outside), false);
});

test("Merge and split decisions preserve prior versions and never destructively rewrite identity", () => {
  const merge = createEventMergeSplitDecision({ kind: "MERGE", sourceEventVersionIds: ["event-v2", "event-v1"], resultingEventVersionIds: ["event-v3"], reason: "The two records resolve to one occurrence." });
  assert.equal(merge.destructive, false);
  assert.deepEqual(merge.sourceEventVersionIds, ["event-v1", "event-v2"]);
  assert.throws(() => createEventMergeSplitDecision({ kind: "SPLIT", sourceEventVersionIds: ["event-v1"], resultingEventVersionIds: ["event-v2"], reason: "Invalid single result." }), /at least two/);
});

test("Knowledge reuse preserves admitted immutable provenance and revalidates risk, conflict, and ongoing facts", () => {
  assert.equal(classifyKnowledgeReuse({ admitted: true, immutableHistorical: true, evidencePreserved: true, higherRiskUse: false, newConflict: false, ongoing: false }), "REUSE_DIRECTLY");
  assert.equal(classifyKnowledgeReuse({ admitted: true, immutableHistorical: true, evidencePreserved: true, higherRiskUse: true, newConflict: false, ongoing: false }), "REVALIDATE");
  assert.equal(classifyKnowledgeReuse({ admitted: true, immutableHistorical: true, evidencePreserved: true, higherRiskUse: false, newConflict: false, ongoing: true }), "REVALIDATE");
});
