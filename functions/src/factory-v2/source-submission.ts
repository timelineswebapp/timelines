import { contentAddressedId } from "./hashing";
import { parseSealedArtifact } from "./contracts/builders";
import { sourceSubmissionCandidateSchema, type SourceSubmissionCandidate } from "./contracts/source-submission";
import { topicOperationSchema } from "./contracts/operations";
import { v2FailureRecordSchema } from "./contracts/knowledge";
import { V2FirestoreRepository } from "./repositories/firestore";

export function deriveSourceSubmissionCandidate(input: { operation: unknown; failure: unknown; submittedUrl: string; rationale: string; submittedBy: string; now: string }): SourceSubmissionCandidate {
  const operation = topicOperationSchema.parse(input.operation);
  const failure = v2FailureRecordSchema.parse(input.failure);
  if (operation.state !== "DEFERRED" || operation.terminalFailureRecordId !== failure.failureRecordId || operation.topicId !== failure.topicId || operation.runId !== failure.runId || operation.generation !== failure.generation) throw new Error("Source submission requires exact deferred terminal lineage.");
  if (failure.autonomousOutcome?.reentryState !== "REQUIRES_RELEVANT_CHANGE" || JSON.stringify(failure.autonomousOutcome) !== JSON.stringify(operation.autonomousOutcome)) throw new Error("Source submission is permitted only for matching public-evidence limitation lineage.");
  const sourceSubmissionCandidateId = contentAddressedId("source-submission", { corpusId: operation.corpusId, topicId: operation.topicId, originalOperationId: operation.operationId, originalFailureRecordId: failure.failureRecordId, submittedUrl: input.submittedUrl, rationale: input.rationale, submittedBy: input.submittedBy });
  return parseSealedArtifact(sourceSubmissionCandidateSchema, {
    artifactId: sourceSubmissionCandidateId, sourceSubmissionCandidateId, schemaVersion: failure.schemaVersion, policyVersion: failure.policyVersion, promptVersion: failure.promptVersion, modelExecutionRef: null, parentArtifactId: failure.failureRecordId, createdAt: input.now, corpusId: operation.corpusId, topicId: operation.topicId, runId: operation.runId, generation: operation.generation, executionMode: "SHADOW", publicationEligible: false, governanceSubmissionAllowed: false, immutable: true,
    originalOperationId: operation.operationId, originalFailureRecordId: failure.failureRecordId, submittedUrl: input.submittedUrl, rationale: input.rationale, submittedBy: input.submittedBy, state: "CANDIDATE", sourceSnapshotId: null
  });
}

export async function listSourceSubmissionCandidates(repository: V2FirestoreRepository, limit: number) {
  const records = await repository.boundedQuery("v2SourceSubmissionCandidates", [], Math.max(1, Math.min(100, Math.trunc(limit))));
  return records.flatMap(({ id: _documentId, ...record }) => {
    const parsed = sourceSubmissionCandidateSchema.safeParse(record);
    return parsed.success ? [{ candidateId: parsed.data.sourceSubmissionCandidateId, operationId: parsed.data.originalOperationId, submittedUrl: parsed.data.submittedUrl, rationale: parsed.data.rationale, submittedBy: parsed.data.submittedBy, createdAt: parsed.data.createdAt, state: parsed.data.state }] : [];
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
