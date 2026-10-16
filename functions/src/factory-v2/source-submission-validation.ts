import { contentAddressedId } from "./hashing";
import { parseSealedArtifact } from "./contracts/builders";
import { sourceSubmissionCandidateSchema } from "./contracts/source-submission";
import { sourceSubmissionValidationSchema } from "./contracts/source-submission-validation";
import { topicOperationSchema } from "./contracts/operations";

export function buildSourceSubmissionAuthorityValidation(input: { candidate: unknown; operation: unknown; publisherVersionId: string; now: string }) {
  const candidate = sourceSubmissionCandidateSchema.parse(input.candidate);
  const operation = topicOperationSchema.parse(input.operation);
  if (operation.operationId !== candidate.originalOperationId || operation.terminalFailureRecordId !== candidate.originalFailureRecordId || operation.topicAuthoritySetId === null) throw new Error("Source-submission validation requires exact deferred authority lineage.");
  const sourceSubmissionValidationId = contentAddressedId("source-submission-validation", { candidateId: candidate.sourceSubmissionCandidateId, operationId: operation.operationId, topicAuthoritySetId: operation.topicAuthoritySetId, publisherVersionId: input.publisherVersionId });
  return parseSealedArtifact(sourceSubmissionValidationSchema, { artifactId: sourceSubmissionValidationId, sourceSubmissionValidationId, schemaVersion: candidate.schemaVersion, policyVersion: candidate.policyVersion, promptVersion: candidate.promptVersion, modelExecutionRef: null, parentArtifactId: candidate.sourceSubmissionCandidateId, createdAt: input.now, corpusId: candidate.corpusId, topicId: candidate.topicId, runId: candidate.runId, generation: candidate.generation, executionMode: "SHADOW", publicationEligible: false, governanceSubmissionAllowed: false, immutable: true, sourceSubmissionCandidateId: candidate.sourceSubmissionCandidateId, originalOperationId: candidate.originalOperationId, originalFailureRecordId: candidate.originalFailureRecordId, topicAuthoritySetId: operation.topicAuthoritySetId, publisherVersionId: input.publisherVersionId, state: "AUTHORITY_ELIGIBLE", sourceSnapshotId: null, qualifyingEvidence: false });
}
