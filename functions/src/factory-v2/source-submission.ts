import { contentAddressedId } from "./hashing";
import { parseSealedArtifact } from "./contracts/builders";
import { sourceSubmissionCandidateSchema, type SourceSubmissionCandidate } from "./contracts/source-submission";
import { topicOperationSchema } from "./contracts/operations";
import { v2FailureRecordSchema } from "./contracts/knowledge";

export function deriveSourceSubmissionCandidate(input: { operation: unknown; failure: unknown; submittedUrl: string; rationale: string; submittedBy: string; now: string }): SourceSubmissionCandidate {
  const operation = topicOperationSchema.parse(input.operation);
  const failure = v2FailureRecordSchema.parse(input.failure);
  if (operation.state !== "DEFERRED" || operation.terminalFailureRecordId !== failure.failureRecordId || operation.topicId !== failure.topicId || operation.runId !== failure.runId || operation.generation !== failure.generation) throw new Error("Source submission requires exact deferred terminal lineage.");
  const sourceSubmissionCandidateId = contentAddressedId("source-submission", { corpusId: operation.corpusId, topicId: operation.topicId, originalOperationId: operation.operationId, originalFailureRecordId: failure.failureRecordId, submittedUrl: input.submittedUrl, rationale: input.rationale, submittedBy: input.submittedBy });
  return parseSealedArtifact(sourceSubmissionCandidateSchema, {
    artifactId: sourceSubmissionCandidateId, sourceSubmissionCandidateId, schemaVersion: failure.schemaVersion, policyVersion: failure.policyVersion, promptVersion: failure.promptVersion, modelExecutionRef: null, parentArtifactId: failure.failureRecordId, createdAt: input.now, corpusId: operation.corpusId, topicId: operation.topicId, runId: operation.runId, generation: operation.generation, executionMode: "SHADOW", publicationEligible: false, governanceSubmissionAllowed: false, immutable: true,
    originalOperationId: operation.operationId, originalFailureRecordId: failure.failureRecordId, submittedUrl: input.submittedUrl, rationale: input.rationale, submittedBy: input.submittedBy, state: "CANDIDATE", sourceSnapshotId: null
  });
}
