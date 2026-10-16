import { contentAddressedId } from "./hashing";
import { parseSealedArtifact } from "./contracts/builders";
import { sourceSubmissionCandidateSchema, type SourceSubmissionCandidate } from "./contracts/source-submission";
import { sourceSubmissionRetrievalSchema } from "./contracts/source-submission-retrieval";
import { sourceSubmissionValidationSchema } from "./contracts/source-submission-validation";
import { topicOperationSchema } from "./contracts/operations";
import { v2FailureRecordSchema } from "./contracts/knowledge";
import { V2FirestoreRepository } from "./repositories/firestore";

function artifactPayload(record: Record<string, unknown>) {
  const { id: _documentId, ...payload } = record;
  return payload;
}

function parseInspectionArtifact<T extends { artifactId: string }>(input: {
  record: Record<string, unknown>;
  schema: { parse: (value: unknown) => T };
  identityLabel: string;
}): T {
  const documentId = input.record.id;
  const artifact = input.schema.parse(artifactPayload(input.record));
  if (typeof documentId === "string" && documentId !== artifact.artifactId) {
    throw new Error(`${input.identityLabel} document identity does not match its payload.`);
  }
  return artifact;
}

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
  const records = await repository.boundedQuery(
    "v2SourceSubmissionCandidates",
    [],
    Math.max(1, Math.min(100, Math.trunc(limit))),
    { field: "createdAt", direction: "desc" }
  );
  return records.flatMap(({ id: _documentId, ...record }) => {
    const parsed = sourceSubmissionCandidateSchema.safeParse(record);
    return parsed.success ? [{ candidateId: parsed.data.sourceSubmissionCandidateId, operationId: parsed.data.originalOperationId, submittedUrl: parsed.data.submittedUrl, rationale: parsed.data.rationale, submittedBy: parsed.data.submittedBy, createdAt: parsed.data.createdAt, state: parsed.data.state }] : [];
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

/**
 * Returns only the immutable operational outcome for a submitted source.
 * This deliberately excludes source contents, evidence segments, dispatch controls,
 * and re-entry authority: a submission remains provenance, never evidence.
 */
export async function inspectSourceSubmissionCandidate(repository: V2FirestoreRepository, candidateId: string) {
  const candidateRecord = await repository.getById("v2SourceSubmissionCandidates", candidateId);
  if (!candidateRecord) throw new Error("Source submission candidate not found.");
  const { id: candidateDocumentId } = candidateRecord;
  const candidatePayload = artifactPayload(candidateRecord);
  if (typeof candidateDocumentId === "string" && candidateDocumentId !== candidateId) throw new Error("Source submission candidate document identity does not match its requested identity.");
  const candidate = sourceSubmissionCandidateSchema.parse(candidatePayload);
  if (candidate.sourceSubmissionCandidateId !== candidateId) throw new Error("Source submission candidate document identity does not match its payload.");

  const [validationRecords, retrievalRecords] = await Promise.all([
    repository.boundedQuery("v2SourceSubmissionValidations", [{ field: "sourceSubmissionCandidateId", op: "==", value: candidateId }], 2),
    repository.boundedQuery("v2SourceSubmissionRetrievals", [{ field: "sourceSubmissionCandidateId", op: "==", value: candidateId }], 2)
  ]);
  if (validationRecords.length > 1 || retrievalRecords.length > 1) throw new Error("Source submission inspection found ambiguous immutable observations.");
  const validation = validationRecords.length === 0 ? null : parseInspectionArtifact({
    record: validationRecords[0]!,
    schema: sourceSubmissionValidationSchema,
    identityLabel: "Source submission validation"
  });
  const retrieval = retrievalRecords.length === 0 ? null : parseInspectionArtifact({
    record: retrievalRecords[0]!,
    schema: sourceSubmissionRetrievalSchema,
    identityLabel: "Source submission retrieval"
  });
  if (retrieval && !validation) throw new Error("Source submission retrieval has no matching authority validation observation.");
  if (validation && (validation.sourceSubmissionCandidateId !== candidateId || validation.originalOperationId !== candidate.originalOperationId || validation.originalFailureRecordId !== candidate.originalFailureRecordId)) {
    throw new Error("Source submission validation lineage does not match its candidate.");
  }
  if (retrieval && (retrieval.sourceSubmissionCandidateId !== candidateId || retrieval.originalOperationId !== candidate.originalOperationId || retrieval.originalFailureRecordId !== candidate.originalFailureRecordId || (validation && retrieval.sourceSubmissionValidationId !== validation.sourceSubmissionValidationId))) {
    throw new Error("Source submission retrieval lineage does not match its candidate.");
  }

  return {
    candidateId,
    state: candidate.state,
    submittedAt: candidate.createdAt,
    validation: validation ? { state: validation.state, recordedAt: validation.createdAt } : null,
    retrieval: retrieval ? {
      state: retrieval.state,
      recordedAt: retrieval.createdAt,
      retrievalDisposition: retrieval.retrievalDisposition,
      rejectionCode: retrieval.rejectionCode
    } : null,
    qualifyingEvidence: false as const,
    reentryAuthorized: false as const
  };
}
