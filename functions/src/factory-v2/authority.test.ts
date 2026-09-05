import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapPublisherRegistry, detectClaimConflicts, evaluateClaimAuthority, independenceGroup } from "./authority";
import { buildAtomicClaimVersion, buildClaimEvidenceEdge } from "./contracts/builders";
import type { AtomicClaimVersion, ClaimEvidenceEdge, PublisherAuthorityVersion } from "./contracts";
import { TEST_CONTEXT, date, scopeFixture } from "./test-fixtures";

const publishers = bootstrapPublisherRegistry(TEST_CONTEXT);
const byName = (name: string) => publishers.find((publisher) => publisher.canonicalName === name)!;
const publisherMap = new Map(publishers.map((publisher) => [publisher.publisherVersionId, publisher]));

function claim(risk: AtomicClaimVersion["risk"] = "MATERIAL", type: AtomicClaimVersion["claimType"] = "DATE", day = 16): AtomicClaimVersion {
  return buildAtomicClaimVersion(TEST_CONTEXT, {
    scopeContractId: scopeFixture().scopeContractId, subject: { kind: "EVENT", id: null, label: "Apollo 11 launch" }, predicate: type,
    object: type === "DATE" ? { kind: "DATE", id: null, value: { ...date(1969, "DAY", 7, day), label: `July ${day}, 1969` } } : { kind: "TEXT", id: null, value: "A bounded historical interpretation" },
    normalizedAssertion: type === "DATE" ? `Apollo 11 launch date was July ${day}, 1969` : "The mission influenced later space policy",
    claimType: type, risk, temporal: null, candidateEventClusterId: "apollo-11-launch", locationEntityIds: [], qualifiers: [], extractedFromSnapshotId: "snapshot-1",
    extractedFromSegmentIds: [`segment-${day}`], conflictState: "NONE", validationState: "AUTHORITY_PENDING", evidenceVerdictId: null, supersedesClaimVersionId: null
  });
}

function edge(value: AtomicClaimVersion, publisher: PublisherAuthorityVersion | undefined, suffix: string, overrides: Partial<Pick<ClaimEvidenceEdge, "relationship" | "relevance" | "authorityFinding" | "independenceGroupId">> = {}): ClaimEvidenceEdge {
  return buildClaimEvidenceEdge(TEST_CONTEXT, {
    claimVersionId: value.claimVersionId, evidenceSegmentId: `segment-${suffix}`, relationship: overrides.relationship || "SUPPORTS", relevance: overrides.relevance || "DIRECT", authorityFinding: overrides.authorityFinding || "STRONG",
    publisherVersionId: publisher?.publisherVersionId || null, independenceGroupId: overrides.independenceGroupId || publisher?.independenceGroupId || `unknown-${suffix}`, dependenceBasis: [], evaluator: "DETERMINISTIC"
  });
}

test("Publisher Registry is deliberately small, versioned, alias-aware, and policy-admitted", () => {
  assert.ok(publishers.length < 20);
  assert.equal(byName("National Aeronautics and Space Administration").aliases.includes("NASA"), true);
  assert.equal(publishers.every((publisher) => publisher.state === "VERIFIED" && publisher.admittedBy === "POLICY"), true);
  assert.equal(new Set(publishers.map((publisher) => publisher.payloadHash)).size, publishers.length);
});

test("One definitive primary record establishes a narrow material mission date", () => {
  const value = claim("MATERIAL", "DATE");
  const verdict = evaluateClaimAuthority({ context: TEST_CONTEXT, claim: value, evidenceEdges: [edge(value, byName("National Aeronautics and Space Administration"), "nasa")], publishersByVersionId: publisherMap });
  assert.equal(verdict.verdict, "SUPPORTED");
  assert.equal(verdict.definitivePrimary, true);
  assert.ok(verdict.reasonCodes.includes("DEFINITIVE_PRIMARY"));
});

test("Interpretive claims require multiple independent strong secondary authorities", () => {
  const value = claim("INTERPRETIVE", "INTERPRETATION");
  const one = edge(value, byName("BBC"), "bbc");
  assert.equal(evaluateClaimAuthority({ context: TEST_CONTEXT, claim: value, evidenceEdges: [one], publishersByVersionId: publisherMap }).verdict, "INSUFFICIENT");
  const two = edge(value, byName("Encyclopaedia Britannica"), "britannica");
  const verdict = evaluateClaimAuthority({ context: TEST_CONTEXT, claim: value, evidenceEdges: [one, two], publishersByVersionId: publisherMap });
  assert.equal(verdict.verdict, "SUPPORTED");
  assert.ok(verdict.reasonCodes.includes("INTERPRETIVE_SECONDARY_BURDEN"));
});

test("Wikipedia is orientation only and never satisfies an accepted claim burden", () => {
  const value = claim("ROUTINE", "DATE");
  const verdict = evaluateClaimAuthority({ context: TEST_CONTEXT, claim: value, evidenceEdges: [edge(value, byName("Wikimedia Foundation"), "wiki")], publishersByVersionId: publisherMap });
  assert.equal(verdict.verdict, "INSUFFICIENT");
  assert.ok(verdict.reasonCodes.includes("WIKIPEDIA_EXCLUDED"));
  assert.equal(verdict.acceptedEvidenceEdgeIds.length, 0);
});

test("Unknown publishers and mention-only evidence fail closed", () => {
  const value = claim("ROUTINE", "DATE");
  const verdict = evaluateClaimAuthority({ context: TEST_CONTEXT, claim: value, evidenceEdges: [edge(value, undefined, "unknown"), edge(value, byName("BBC"), "mention", { relationship: "MENTIONS" })], publishersByVersionId: publisherMap });
  assert.equal(verdict.verdict, "INSUFFICIENT");
  assert.ok(verdict.reasonCodes.includes("MENTION_ONLY"));
  assert.ok(verdict.reasonCodes.includes("WEAK_AUTHORITY"));
});

test("Publisher-parent, syndication, content hash, and underlying source grouping prevent false corroboration", () => {
  const bbc = byName("BBC");
  const child = { ...bbc, publisherId: "00000000-0000-5000-8000-000000000123", parentPublisherId: bbc.publisherId };
  assert.deepEqual(independenceGroup({ publisher: child, contentHash: "a".repeat(64) }).dependenceBasis, ["SAME_PARENT_PUBLISHER"]);
  assert.deepEqual(independenceGroup({ publisher: undefined, contentHash: "a".repeat(64), syndicatedFromPublisherId: bbc.publisherId }).dependenceBasis, ["SYNDICATED_COPY"]);
  assert.deepEqual(independenceGroup({ publisher: undefined, contentHash: "a".repeat(64), underlyingSourceId: "press-release-1" }).dependenceBasis, ["COMMON_UNDERLYING_SOURCE"]);
  assert.deepEqual(independenceGroup({ publisher: undefined, contentHash: "a".repeat(64) }).dependenceBasis, ["IDENTICAL_CONTENT_HASH"]);
});

test("Material conflicting authoritative claims are preserved and block PASS", () => {
  const left = claim("MATERIAL", "DATE", 16);
  const right = claim("MATERIAL", "DATE", 17);
  const edges = [edge(left, byName("National Aeronautics and Space Administration"), "nasa"), edge(right, byName("BBC"), "bbc")];
  const conflicts = detectClaimConflicts({ context: TEST_CONTEXT, claims: [left, right], evidenceEdges: edges });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]!.state, "UNRESOLVED");
  assert.equal(conflicts[0]!.blocksPass, true);
  assert.equal(evaluateClaimAuthority({ context: TEST_CONTEXT, claim: left, evidenceEdges: [edges[0]!], publishersByVersionId: publisherMap, conflictSet: conflicts[0] }).verdict, "REVIEW_REQUIRED");
});

test("Sensitive claims always route to human review even with independent evidence", () => {
  const value = claim("SENSITIVE", "INTERPRETATION");
  const verdict = evaluateClaimAuthority({ context: TEST_CONTEXT, claim: value, evidenceEdges: [edge(value, byName("BBC"), "bbc"), edge(value, byName("Reuters"), "reuters")], publishersByVersionId: publisherMap });
  assert.equal(verdict.verdict, "REVIEW_REQUIRED");
  assert.ok(verdict.reasonCodes.includes("SENSITIVE_HUMAN_REVIEW"));
});
