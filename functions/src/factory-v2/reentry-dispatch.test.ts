import assert from "node:assert/strict";
import test from "node:test";
import { immutableEnvelope, parseSealedArtifact } from "./contracts/builders";
import { deferredReentryRequestSchema, v2FailureRecordSchema } from "./contracts";
import { planDeferredReentryDispatch } from "./reentry-dispatch";

const outcome = { policyVersion: "autonomous-public-evidence.1", classification: "PUBLIC_EVIDENCE_LIMITATION" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_RELEVANT_CHANGE" as const, detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" };
const context = { corpusId: "test-clean-corpus", topicId: "topic-reentry-001", runId: "run-original-001", generation: 1, createdAt: "2026-10-16T00:00:00.000Z" };
const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, "failure-reentry-001"), failureRecordId: "failure-reentry-001", stage: "A2_SCOPE_ACQUISITION", failureClass: "FAILED_UNCLASSIFIED", severity: "HIGH", retryable: false, message: "Governed public evidence capacity is exhausted.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 1, budgetConsumed: {}, autonomousOutcome: outcome });
const operation = { operationId: "operation-reentry-001", corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: 1, pipelineVersion: "factory-v2-a.70" as const, executionMode: "SHADOW" as const, state: "DEFERRED" as const, stage: "A2_SCOPE_ACQUISITION" as const, scopeState: "LOCKED", researchMapState: "VALID", currentBlockingReason: "capacity", counts: {}, budgetsConsumed: {}, elapsedMs: 1, finalVerdict: "FAIL" as const, terminalFailureRecordId: failure.failureRecordId, autonomousOutcome: outcome, updatedAt: context.createdAt };
const request = parseSealedArtifact(deferredReentryRequestSchema, { ...immutableEnvelope({ ...context, runId: "run-reentry-002", generation: 2 }, "request-reentry-001"), deferredReentryRequestId: "request-reentry-001", originalFailureRecordId: failure.failureRecordId, originalOperationId: operation.operationId, originalRunId: context.runId, originalGeneration: 1, nextRunId: "run-reentry-002", nextGeneration: 2, originalRelease: { pipelineVersion: "factory-v2-a.70", schemaVersion: "factory-v2-a.15", policyVersion: "authority-first-research.43", promptVersion: null }, outcome, trigger: "RELEVANT_EVIDENCE_CHANGE" as const, relevantChangeArtifactId: "governed-change-001", authorizedBy: null, state: "REQUESTED" as const });

test("deferred dispatch rejects stale immutable lineage and queues exactly the next generation", () => {
  assert.equal(planDeferredReentryDispatch({ request, operation, failure, now: "2026-10-16T01:00:00.000Z" }).state, "QUEUED");
  assert.throws(() => planDeferredReentryDispatch({ request, operation: { ...operation, state: "FAILED" }, failure, now: "2026-10-16T01:00:00.000Z" }), /lineage/);
});
