import assert from "node:assert/strict";
import test from "node:test";
import { listDeferredTopicAdminSummaries } from "./admin-read-model";
import { parseSealedArtifact, immutableEnvelope } from "./contracts/builders";
import { v2FailureRecordSchema } from "./contracts/knowledge";

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
  const queryCalls: unknown[][] = [];
  const repository = {
    boundedQuery: async (...args: unknown[]) => {
      queryCalls.push(args);
      return [
      { id: deferredOperation.operationId, ...deferredOperation }
      ];
    },
    getById: async () => ({ id: failure.failureRecordId, ...failure })
  };
  const results = await listDeferredTopicAdminSummaries(repository as never, 25);
  assert.deepEqual(queryCalls, [["v2TopicOperations", [{ field: "state", op: "==", value: "DEFERRED" }], 25, { field: "updatedAt", direction: "desc" }]]);
  assert.deepEqual(results, [{
    topicId: "topic-deferred-001",
    runId: "run-deferred-001",
    generation: 2,
    stage: "A2_SCOPE_ACQUISITION",
    updatedAt: "2026-10-16T00:00:00.000Z",
    terminalFailureRecordId: "failure-deferred-001",
    outcome: deferredOperation.autonomousOutcome,
    operationalFeasibility: { state: "REENTRY_CONDITION_REQUIRED", requiredCondition: "RELEVANT_EVIDENCE_CHANGE", terminalAt: deferredOperation.updatedAt, attemptsConsumed: 2, budgetConsumed: { providerQueries: 10 }, failureClass: "FAILED_UNCLASSIFIED" }
  }]);
});

test("deferred-topic read model fails closed on corrupt persisted operation or terminal failure", async () => {
  const malformedOperationRepository = {
    boundedQuery: async () => [{ id: "operation-document-mismatch", ...deferredOperation }],
    getById: async () => null
  };
  await assert.rejects(listDeferredTopicAdminSummaries(malformedOperationRepository as never, 25), /operation document identity/);

  const invalidFailureRepository = {
    boundedQuery: async () => [{ id: deferredOperation.operationId, ...deferredOperation }],
    getById: async () => ({ id: deferredOperation.terminalFailureRecordId, payloadHash: "0".repeat(64) })
  };
  await assert.rejects(listDeferredTopicAdminSummaries(invalidFailureRepository as never, 25));
});
