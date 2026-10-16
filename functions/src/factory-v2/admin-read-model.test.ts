import assert from "node:assert/strict";
import test from "node:test";
import { listDeferredTopicAdminSummaries } from "./admin-read-model";
import { parseSealedArtifact, immutableEnvelope } from "./contracts/builders";
import { v2FailureRecordSchema } from "./contracts/knowledge";
import { deferredReentryDispatchReceiptSchema, deferredReentryRequestSchema } from "./contracts/reentry";

const deferredOperation = {
  operationId: "run-deferred-001",
  corpusId: "test-clean-corpus",
  topicId: "topic-deferred-001",
  runId: "run-deferred-001",
  generation: 2,
  pipelineVersion: "factory-v2-a.70",
  executionMode: "SHADOW",
  state: "DEFERRED",
  stage: "A2_SCOPE_ACQUISITION",
  scopeState: "LOCKED",
  researchMapState: "VALID",
  currentBlockingReason: "PROTECTED_REPRESENTATION_AVAILABILITY_INSUFFICIENT",
  counts: {},
  budgetsConsumed: {},
  elapsedMs: 100,
  finalVerdict: "FAIL",
  terminalFailureRecordId: "failure-deferred-001",
  autonomousOutcome: {
    policyVersion: "autonomous-public-evidence.1",
    classification: "PUBLIC_EVIDENCE_LIMITATION",
    disposition: "DEFERRED",
    reentryState: "REQUIRES_RELEVANT_CHANGE",
    detailedReason: "FAILED_UNCLASSIFIED",
    publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED"
  },
  updatedAt: "2026-10-16T00:00:00.000Z"
};

test("deferred-topic read model exposes only valid deferred lineage", async () => {
  const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope({ corpusId: deferredOperation.corpusId, topicId: deferredOperation.topicId, runId: deferredOperation.runId, generation: deferredOperation.generation, createdAt: deferredOperation.updatedAt }, deferredOperation.terminalFailureRecordId!), failureRecordId: deferredOperation.terminalFailureRecordId, stage: deferredOperation.stage, failureClass: "FAILED_UNCLASSIFIED", severity: "HIGH", retryable: false, message: "Governed public evidence capacity is exhausted.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 2, budgetConsumed: { providerQueries: 10 }, autonomousOutcome: deferredOperation.autonomousOutcome });
  const request = parseSealedArtifact(deferredReentryRequestSchema, {
    ...immutableEnvelope({ corpusId: deferredOperation.corpusId, topicId: deferredOperation.topicId, runId: "run-deferred-reentry-002", generation: 3, createdAt: "2026-10-16T00:01:00.000Z" }, "request-deferred-001"),
    deferredReentryRequestId: "request-deferred-001", originalFailureRecordId: failure.failureRecordId, originalOperationId: deferredOperation.operationId, originalRunId: deferredOperation.runId, originalGeneration: deferredOperation.generation, nextRunId: "run-deferred-reentry-002", nextGeneration: 3,
    originalRelease: { pipelineVersion: "factory-v2-a.70", schemaVersion: "factory-v2-a.15", policyVersion: "authority-first-research.43", promptVersion: null }, outcome: deferredOperation.autonomousOutcome,
    trigger: "RELEVANT_EVIDENCE_CHANGE", relevantChangeArtifactId: "snapshot-relevant-001", authorizedBy: null, authorizationReason: null, state: "REQUESTED"
  });
  const receipt = parseSealedArtifact(deferredReentryDispatchReceiptSchema, {
    ...immutableEnvelope({ corpusId: deferredOperation.corpusId, topicId: deferredOperation.topicId, runId: request.nextRunId, generation: request.nextGeneration, createdAt: "2026-10-16T00:02:00.000Z" }, request.deferredReentryRequestId),
    deferredReentryDispatchReceiptId: request.deferredReentryRequestId, deferredReentryRequestId: request.deferredReentryRequestId, queuedOperationId: request.nextRunId, consumedAt: "2026-10-16T00:02:00.000Z", state: "CONSUMED"
  });
  const queryCalls: unknown[][] = [];
  const repository = {
    activeCorpusId: () => deferredOperation.corpusId,
    boundedQuery: async (name: string, ...args: unknown[]) => {
      queryCalls.push(args);
      return name === "v2TopicOperations" ? [{ id: deferredOperation.operationId, ...deferredOperation }] : [{ id: request.deferredReentryRequestId, ...request }];
    },
    getById: async (name: string) => name === "v2FailureRecords" ? ({ id: failure.failureRecordId, ...failure }) : ({ id: receipt.deferredReentryDispatchReceiptId, ...receipt })
  };
  const results = await listDeferredTopicAdminSummaries(repository as never, 25);
  assert.deepEqual(queryCalls, [
    [[{ field: "state", op: "==", value: "DEFERRED" }], 25, { field: "updatedAt", direction: "desc" }],
    [[{ field: "originalOperationId", op: "==", value: deferredOperation.operationId }], 5, { field: "createdAt", direction: "desc" }]
  ]);
  assert.deepEqual(results, [{
    topicId: "topic-deferred-001",
    runId: "run-deferred-001",
    generation: 2,
    stage: "A2_SCOPE_ACQUISITION",
    updatedAt: "2026-10-16T00:00:00.000Z",
    terminalFailureRecordId: "failure-deferred-001",
    outcome: deferredOperation.autonomousOutcome,
    operationalFeasibility: { state: "REENTRY_CONDITION_REQUIRED", requiredCondition: "RELEVANT_EVIDENCE_CHANGE", terminalAt: deferredOperation.updatedAt, attemptsConsumed: 2, budgetConsumed: { providerQueries: 10 }, failureClass: "FAILED_UNCLASSIFIED" },
    reentryRequests: [{ requestId: request.deferredReentryRequestId, trigger: "RELEVANT_EVIDENCE_CHANGE", requestedAt: request.createdAt, state: "CONSUMED", consumedAt: receipt.consumedAt, queuedRunId: request.nextRunId }]
  }]);

  const corruptReentryRepository = {
    activeCorpusId: () => deferredOperation.corpusId,
    boundedQuery: async (name: string) => name === "v2TopicOperations" ? [{ id: deferredOperation.operationId, ...deferredOperation }] : [{ id: "mismatched-request-document", ...request }],
    getById: async (name: string) => name === "v2FailureRecords" ? ({ id: failure.failureRecordId, ...failure }) : null
  };
  await assert.rejects(listDeferredTopicAdminSummaries(corruptReentryRepository as never, 25), /Deferred re-entry request integrity/);
});

test("deferred-topic read model fails closed on corrupt persisted operation or terminal failure", async () => {
  const malformedOperationRepository = {
    boundedQuery: async () => [{ id: "operation-document-mismatch", ...deferredOperation }],
    activeCorpusId: () => deferredOperation.corpusId,
    getById: async () => null
  };
  await assert.rejects(listDeferredTopicAdminSummaries(malformedOperationRepository as never, 25), /operation document identity/);

  const invalidFailureRepository = {
    boundedQuery: async () => [{ id: deferredOperation.operationId, ...deferredOperation }],
    activeCorpusId: () => deferredOperation.corpusId,
    getById: async () => ({ id: deferredOperation.terminalFailureRecordId, payloadHash: "0".repeat(64) })
  };
  await assert.rejects(listDeferredTopicAdminSummaries(invalidFailureRepository as never, 25));
});
