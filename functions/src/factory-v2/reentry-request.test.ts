import assert from "node:assert/strict";
import test from "node:test";
import { parseSealedArtifact, immutableEnvelope } from "./contracts/builders";
import { sourceSnapshotSchema, v2FailureRecordSchema } from "./contracts/knowledge";
import { deriveDeferredReentryRequest } from "./reentry-request";

const context = { corpusId: "reentry-request-corpus", topicId: "topic-reentry-request", runId: "run-reentry-original", generation: 1, createdAt: "2026-10-16T00:00:00.000Z" };
const outcome = { policyVersion: "autonomous-public-evidence.1" as const, classification: "PUBLIC_EVIDENCE_LIMITATION" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_RELEVANT_CHANGE" as const, detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" as const };
const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, "failure-reentry-request"), failureRecordId: "failure-reentry-request", stage: "A2_SCOPE_ACQUISITION", failureClass: "FAILED_UNCLASSIFIED", severity: "HIGH", retryable: false, message: "Governed public evidence capacity is exhausted.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 1, budgetConsumed: {}, autonomousOutcome: outcome });
const operation = { operationId: "operation-reentry-request", corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: 1, pipelineVersion: "factory-v2-a.70" as const, executionMode: "SHADOW" as const, state: "DEFERRED" as const, stage: "A2_SCOPE_ACQUISITION" as const, scopeState: "LOCKED", researchMapState: "VALID", currentBlockingReason: "capacity", counts: {}, budgetsConsumed: {}, elapsedMs: 1, finalVerdict: "FAIL" as const, terminalFailureRecordId: failure.failureRecordId, autonomousOutcome: outcome, updatedAt: context.createdAt };
const source = { sourceId: "source-reentry-request", corpusId: context.corpusId, canonicalUrl: "https://example.org/reentry", canonicalUrlHash: "a".repeat(64), publisherId: "f72f9a46-2d8a-4e17-88ca-0fd19cc6b581", title: "Newly accessible source", authors: [], publicationDate: null, sourceClass: "PRIMARY_INSTITUTIONAL" as const, language: "en", primarySecondaryRole: "PRIMARY" as const, authorityDomains: ["history"], access: "OPEN" as const, currentSnapshotId: "snapshot-reentry-request", supersedesSourceId: null, identityHash: "b".repeat(64), updatedAt: "2026-10-16T00:02:00.000Z" };
const snapshot = parseSealedArtifact(sourceSnapshotSchema, { ...immutableEnvelope({ ...context, runId: "source-retrieval-run", createdAt: "2026-10-16T00:02:00.000Z" }, "snapshot-reentry-request"), sourceSnapshotId: "snapshot-reentry-request", sourceId: source.sourceId, retrievalUrl: source.canonicalUrl, resolvedUrl: source.canonicalUrl, redirectChain: [], retrievedAt: "2026-10-16T00:02:00.000Z", retrievalMethod: "HTTP", retrievalDisposition: "NEWLY_RETRIEVED", mediaType: "text/html", language: "en", publicationDateObserved: null, rawObjectRef: null, extractedTextObjectRef: null, boundedExtractedText: "A newly available public source.", contentHash: "c".repeat(64), extractionHash: null, groundingMetadataRef: null, etag: null, lastModified: null, license: null, contentBytes: 32, accessLimitations: [], partial: false, supersedesSnapshotId: null });

test("deferred re-entry derives immutable lineage only from a post-terminal governed source change", () => {
  const first = deriveDeferredReentryRequest({ operation, failure, trigger: "RELEVANT_EVIDENCE_CHANGE", relevantChangeArtifactId: snapshot.sourceSnapshotId, relevantSourceDocument: source, relevantSourceSnapshot: snapshot, now: "2026-10-16T00:03:00.000Z" });
  const replay = deriveDeferredReentryRequest({ operation, failure, trigger: "RELEVANT_EVIDENCE_CHANGE", relevantChangeArtifactId: snapshot.sourceSnapshotId, relevantSourceDocument: source, relevantSourceSnapshot: snapshot, now: "2026-10-16T00:04:00.000Z" });
  assert.equal(first.deferredReentryRequestId, replay.deferredReentryRequestId);
  assert.equal(first.nextRunId, replay.nextRunId);
  assert.equal(first.originalFailureRecordId, failure.failureRecordId);
  assert.equal(first.nextGeneration, 2);
  assert.equal(first.parentArtifactId, failure.failureRecordId);
  assert.throws(() => deriveDeferredReentryRequest({ operation, failure, trigger: "RELEVANT_EVIDENCE_CHANGE", relevantChangeArtifactId: snapshot.sourceSnapshotId, relevantSourceDocument: { ...source, access: "LIMITED" }, relevantSourceSnapshot: snapshot, now: "2026-10-16T00:03:00.000Z" }), /Relevant change/);
  assert.throws(() => deriveDeferredReentryRequest({ operation, failure, trigger: "AUTHORIZED_RETRY", authorizedBy: "operator-001", now: "2026-10-16T00:03:00.000Z" }), /require one governed/);
});
