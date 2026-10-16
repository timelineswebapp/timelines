import { v2FailureRecordSchema } from "./contracts/knowledge";
import { topicOperationSchema } from "./contracts/operations";
import { deferredReentryRequestSchema } from "./contracts/reentry";

/** Pure, fail-closed precondition check for the later transactional consumer. */
export function planDeferredReentryDispatch(input: { request: unknown; operation: unknown; failure: unknown; now: string }) {
  const request = deferredReentryRequestSchema.parse(input.request);
  const operation = topicOperationSchema.parse(input.operation);
  const failure = v2FailureRecordSchema.parse(input.failure);
  if (operation.state !== "DEFERRED" || operation.terminalFailureRecordId !== request.originalFailureRecordId) throw new Error("Deferred operation lineage no longer matches the re-entry request.");
  if (operation.operationId !== request.originalOperationId || operation.runId !== request.originalRunId || operation.generation !== request.originalGeneration) throw new Error("Re-entry request does not match the original operation.");
  if (failure.failureRecordId !== request.originalFailureRecordId || failure.runId !== request.originalRunId || failure.topicId !== request.topicId || failure.generation !== request.originalGeneration) throw new Error("Re-entry request does not match immutable failure lineage.");
  if (failure.autonomousOutcome === null || JSON.stringify(failure.autonomousOutcome) !== JSON.stringify(request.outcome)) throw new Error("Immutable failure outcome does not match the re-entry request.");
  if (operation.pipelineVersion !== request.originalRelease.pipelineVersion || failure.schemaVersion !== request.originalRelease.schemaVersion || failure.policyVersion !== request.originalRelease.policyVersion || failure.promptVersion !== request.originalRelease.promptVersion) throw new Error("Re-entry release identity diverged from immutable lineage.");
  return topicOperationSchema.parse({
    ...operation, operationId: request.nextRunId, runId: request.nextRunId, generation: request.nextGeneration,
    state: "QUEUED", stage: "A1_SCHEMAS", scopeState: "PENDING", researchMapState: "PENDING", currentBlockingReason: null,
    counts: {}, budgetsConsumed: {}, elapsedMs: 0, finalVerdict: "PENDING", terminalFailureRecordId: null, autonomousOutcome: null, updatedAt: input.now
  });
}
