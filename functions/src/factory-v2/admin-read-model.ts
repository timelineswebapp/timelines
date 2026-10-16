import { deferredReentryDispatchReceiptSchema, deferredReentryRequestSchema, topicOperationSchema, v2FailureRecordSchema } from "./contracts";
import { verifyPayloadHash } from "./hashing";
import { V2FirestoreRepository } from "./repositories/firestore";
import { deriveDeferredOperationalFeasibility, type DeferredOperationalFeasibility } from "./operational-feasibility";

export type DeferredTopicAdminSummary = {
  topicId: string;
  runId: string;
  generation: number;
  stage: string;
  updatedAt: string;
  terminalFailureRecordId: string | null;
  outcome: NonNullable<ReturnType<typeof topicOperationSchema.parse>["autonomousOutcome"]>;
  operationalFeasibility: DeferredOperationalFeasibility;
  reentryRequests: Array<{
    requestId: string;
    trigger: "RELEVANT_EVIDENCE_CHANGE" | "AUTHORIZED_RETRY";
    requestedAt: string;
    state: "REQUESTED" | "CONSUMED";
    consumedAt: string | null;
    queuedRunId: string | null;
  }>;
};

const DEFERRED_REENTRY_STATUS_LIMIT = 5;

async function listDeferredReentryStatuses(repository: V2FirestoreRepository, operationId: string) {
  const records = await repository.boundedQuery(
    "v2DeferredReentryRequests",
    [{ field: "originalOperationId", op: "==", value: operationId }],
    DEFERRED_REENTRY_STATUS_LIMIT,
    { field: "createdAt", direction: "desc" }
  );
  return Promise.all(records.map(async ({ id: documentId, ...record }) => {
    const request = deferredReentryRequestSchema.parse(record);
    if (documentId !== request.deferredReentryRequestId || request.corpusId !== repository.activeCorpusId() || request.originalOperationId !== operationId || !verifyPayloadHash(request)) {
      throw new Error("Deferred re-entry request integrity is invalid.");
    }
    const receiptRecord = await repository.getById("v2DeferredReentryDispatchReceipts", request.deferredReentryRequestId);
    if (receiptRecord === null) {
      return { requestId: request.deferredReentryRequestId, trigger: request.trigger, requestedAt: request.createdAt, state: "REQUESTED" as const, consumedAt: null, queuedRunId: null };
    }
    const { id: receiptDocumentId, ...receiptPayload } = receiptRecord;
    const receipt = deferredReentryDispatchReceiptSchema.parse(receiptPayload);
    if (receiptDocumentId !== receipt.deferredReentryDispatchReceiptId || receipt.corpusId !== repository.activeCorpusId() || receipt.deferredReentryRequestId !== request.deferredReentryRequestId || receipt.queuedOperationId !== request.nextRunId || !verifyPayloadHash(receipt)) {
      throw new Error("Deferred re-entry consumption receipt integrity is invalid.");
    }
    return { requestId: request.deferredReentryRequestId, trigger: request.trigger, requestedAt: request.createdAt, state: "CONSUMED" as const, consumedAt: receipt.consumedAt, queuedRunId: receipt.queuedOperationId };
  }));
}

export async function listDeferredTopicAdminSummaries(repository: V2FirestoreRepository, limit: number): Promise<DeferredTopicAdminSummary[]> {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const records = await repository.boundedQuery(
    "v2TopicOperations",
    [{ field: "state", op: "==", value: "DEFERRED" }],
    boundedLimit,
    { field: "updatedAt", direction: "desc" }
  );
  const operations = records.map(({ id: documentId, ...record }) => {
      const operation = topicOperationSchema.parse(record);
      if (documentId !== operation.operationId) throw new Error("Deferred operation document identity does not match its payload.");
      if (operation.autonomousOutcome === null) throw new Error("Deferred operation has no autonomous outcome.");
      return {
        operation,
        summary: {
          topicId: operation.topicId,
          runId: operation.runId,
          generation: operation.generation,
          stage: operation.stage,
          updatedAt: operation.updatedAt,
          terminalFailureRecordId: operation.terminalFailureRecordId,
          outcome: operation.autonomousOutcome
        }
      };
    });
  const summaries = await Promise.all(operations.map(async ({ operation, summary }) => {
    if (summary.terminalFailureRecordId === null) throw new Error("Deferred operation has no terminal failure lineage.");
    const failure = await repository.getById("v2FailureRecords", summary.terminalFailureRecordId);
    if (failure === null) throw new Error("Deferred operation terminal failure is unavailable.");
    const { id: failureDocumentId, ...failureRecord } = failure;
    const parsedFailure = v2FailureRecordSchema.parse(failureRecord);
    if (failureDocumentId !== parsedFailure.failureRecordId || !verifyPayloadHash(parsedFailure)) throw new Error("Deferred operation terminal failure integrity is invalid.");
    const reentryRequests = await listDeferredReentryStatuses(repository, operation.operationId);
    return { ...summary, operationalFeasibility: deriveDeferredOperationalFeasibility({ operation, failure: parsedFailure }), reentryRequests };
  }));
  return summaries
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
