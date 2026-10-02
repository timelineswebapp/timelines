import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeConstructionError, canInitialAcquisitionEnterCoverage, stripRepositoryDocumentId } from "./knowledge";
import { minimumKnowledgeBlockingReasons, uniqueProviderQueries, type V2ACertificationMetrics } from "../factory-v2/orchestrator";

test("repository hydration removes only the Firestore document id before strict artifact parsing", () => {
  const artifact = { id: "provider-or-repository-owned-id", artifactId: "artifact-1", payloadHash: "a".repeat(64), nested: { id: "historical-external-id" } };
  assert.deepEqual(stripRepositoryDocumentId(artifact), { artifactId: "artifact-1", payloadHash: "a".repeat(64), nested: { id: "historical-external-id" } });
});

test("deadline failures retain accumulated acquisition metrics for the canary report", () => {
  const partial = { providerCalls: 3, directRetrievalAttempts: 12, retrievalFailures: 2, claimsExtracted: 17, claimsSupported: 5, eventCandidates: 4 } as V2ACertificationMetrics;
  const error = new KnowledgeConstructionError("WHOLE_RUN_DEADLINE_EXCEEDED", "GAP_COMPLETION", [], { initialAuditId: "audit-initial", finalAuditId: null }, [partial]);
  assert.equal(error.acquisitionMetrics[0]!.providerCalls, 3);
  assert.equal(error.acquisitionMetrics[0]!.directRetrievalAttempts, 12);
  assert.equal(error.acquisitionMetrics[0]!.claimsSupported, 5);
});

test("completion evidence is merged before event sufficiency is judged", () => {
  const evidenceOnly = { durableSources: 1, claims: 2, supportedClaims: 1, eventCandidates: 0, unresolvedMaterialConflicts: 0 };
  assert.deepEqual(minimumKnowledgeBlockingReasons({ continuation: true, ...evidenceOnly }), []);
  assert.deepEqual(minimumKnowledgeBlockingReasons({ continuation: false, ...evidenceOnly }), ["NO_RESOLVED_EVENT_CANDIDATES"]);
  assert.deepEqual(minimumKnowledgeBlockingReasons({ continuation: true, ...evidenceOnly, supportedClaims: 0 }), ["NO_SUPPORTED_CLAIMS"]);
});

test("provider-reported query budget counts normalized unique searches across grounding calls", () => {
  const queries = uniqueProviderQueries([
    { webSearchQueries: ["Printing Press History", "Gutenberg archives"] },
    { webSearchQueries: ["  printing   press history ", "Cambridge print history"] }
  ]);
  assert.deepEqual(queries, ["cambridge print history", "gutenberg archives", "printing press history"]);
});

test("supported initial evidence with only a missing event inventory enters bounded coverage completion", () => {
  const metrics = { finalV2AVerdict: "FAIL", sourceDocumentsSnapshotted: 5, claimsSupported: 6 } as V2ACertificationMetrics;
  assert.equal(canInitialAcquisitionEnterCoverage({ metrics, blockingReasons: ["NO_RESOLVED_EVENT_CANDIDATES"] }), true);
  assert.equal(canInitialAcquisitionEnterCoverage({ metrics, blockingReasons: ["NO_SUPPORTED_CLAIMS", "NO_RESOLVED_EVENT_CANDIDATES"] }), false);
  assert.equal(canInitialAcquisitionEnterCoverage({ metrics: { ...metrics, claimsSupported: 0 }, blockingReasons: ["NO_RESOLVED_EVENT_CANDIDATES"] }), false);
});
