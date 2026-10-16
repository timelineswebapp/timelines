import { topicOperationSchema } from "./contracts";
import { V2FirestoreRepository } from "./repositories/firestore";

export type DeferredTopicAdminSummary = {
  topicId: string;
  runId: string;
  generation: number;
  stage: string;
  updatedAt: string;
  terminalFailureRecordId: string | null;
  outcome: NonNullable<ReturnType<typeof topicOperationSchema.parse>["autonomousOutcome"]>;
};

export async function listDeferredTopicAdminSummaries(repository: V2FirestoreRepository, limit: number): Promise<DeferredTopicAdminSummary[]> {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const records = await repository.boundedQuery("v2TopicOperations", [{ field: "state", op: "==", value: "DEFERRED" }], boundedLimit);
  return records
    // Firestore repository reads include the document id as transport metadata;
    // operationSchema is intentionally strict and validates persisted fields only.
    .map(({ id: _documentId, ...record }) => topicOperationSchema.safeParse(record))
    .flatMap((parsed) => parsed.success && parsed.data.autonomousOutcome !== null ? [{
      topicId: parsed.data.topicId,
      runId: parsed.data.runId,
      generation: parsed.data.generation,
      stage: parsed.data.stage,
      updatedAt: parsed.data.updatedAt,
      terminalFailureRecordId: parsed.data.terminalFailureRecordId,
      outcome: parsed.data.autonomousOutcome
    }] : [])
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
