import { topicOperationSchema } from "./contracts";
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
};

export async function listDeferredTopicAdminSummaries(repository: V2FirestoreRepository, limit: number): Promise<DeferredTopicAdminSummary[]> {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const records = await repository.boundedQuery("v2TopicOperations", [{ field: "state", op: "==", value: "DEFERRED" }], boundedLimit);
  const operations = records
    // Firestore repository reads include the document id as transport metadata;
    // operationSchema is intentionally strict and validates persisted fields only.
    .flatMap(({ id: _documentId, ...record }) => {
      const parsed = topicOperationSchema.safeParse(record);
      return parsed.success && parsed.data.autonomousOutcome !== null ? [{
        operation: record,
        summary: {
          topicId: parsed.data.topicId,
          runId: parsed.data.runId,
          generation: parsed.data.generation,
          stage: parsed.data.stage,
          updatedAt: parsed.data.updatedAt,
          terminalFailureRecordId: parsed.data.terminalFailureRecordId,
          outcome: parsed.data.autonomousOutcome
        }
      }] : [];
    });
  const summaries = await Promise.all(operations.map(async ({ operation, summary }) => {
    if (summary.terminalFailureRecordId === null) return null;
    const failure = await repository.getById("v2FailureRecords", summary.terminalFailureRecordId);
    if (failure === null) return null;
    try {
      return { ...summary, operationalFeasibility: deriveDeferredOperationalFeasibility({ operation, failure: (() => { const { id: _failureDocumentId, ...failureRecord } = failure; return failureRecord; })() }) };
    } catch {
      return null;
    }
  }));
  return summaries.flatMap((summary) => summary === null ? [] : [summary])
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
