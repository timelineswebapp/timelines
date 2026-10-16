import { retrieveSource, type RetrievalDependencies } from "./acquisition/retrieval";
import { contentAddressedId } from "./hashing";
import { parseSealedArtifact } from "./contracts/builders";
import { sourceDocumentSchema, type PublisherAuthorityVersion, type SourceDocument, type SourceSnapshot, type EvidenceSegment } from "./contracts/knowledge";
import { sourceSubmissionCandidateSchema } from "./contracts/source-submission";
import { sourceSubmissionRetrievalSchema, type SourceSubmissionRetrieval } from "./contracts/source-submission-retrieval";
import { sourceSubmissionValidationSchema } from "./contracts/source-submission-validation";
import { sourceSubmissionUrlMatchesAuthority } from "./source-submission-eligibility";
import type { V2FirestoreRepository } from "./repositories/firestore";

function provisionalSourceClass(publisher: PublisherAuthorityVersion): SourceDocument["sourceClass"] {
  if (publisher.institutionType === "ARCHIVE") return "PRIMARY_INSTITUTIONAL";
  if (publisher.institutionType === "SCHOLARLY_PUBLISHER") return "SCHOLARLY_SECONDARY";
  if (publisher.institutionType === "EDITED_REFERENCE") return "EDITED_REFERENCE";
  if (publisher.institutionType === "NEWSROOM") return "ESTABLISHED_JOURNALISM";
  if (publisher.state === "VERIFIED" && publisher.primarySecondaryTendency === "PRIMARY") return "PRIMARY_INSTITUTIONAL";
  return "SPECIALIST";
}

function rejectionCode(error: unknown): string {
  const value = error instanceof Error ? error.message : "SOURCE_SUBMISSION_RETRIEVAL_UNKNOWN_FAILURE";
  return value.split(":", 1)[0]!.replace(/[^A-Za-z0-9_.-]/gu, "_").slice(0, 160) || "SOURCE_SUBMISSION_RETRIEVAL_UNKNOWN_FAILURE";
}

export function buildSourceSubmissionRetrieval(input: {
  validation: unknown;
  state: "RETRIEVED_UNQUALIFIED" | "RETRIEVAL_REJECTED";
  now: string;
  source?: Pick<SourceDocument, "sourceId"> | null;
  snapshot?: Pick<SourceSnapshot, "sourceSnapshotId" | "retrievalDisposition"> | null;
  rejectionCode?: string | null;
}): SourceSubmissionRetrieval {
  const validation = sourceSubmissionValidationSchema.parse(input.validation);
  const source = input.source || null;
  const snapshot = input.snapshot || null;
  const sourceSubmissionRetrievalId = contentAddressedId("source-submission-retrieval", {
    validationId: validation.sourceSubmissionValidationId,
    state: input.state,
    sourceId: source?.sourceId || null,
    sourceSnapshotId: snapshot?.sourceSnapshotId || null,
    retrievalDisposition: snapshot?.retrievalDisposition || null,
    rejectionCode: input.rejectionCode || null
  });
  return parseSealedArtifact(sourceSubmissionRetrievalSchema, {
    artifactId: sourceSubmissionRetrievalId, sourceSubmissionRetrievalId,
    schemaVersion: validation.schemaVersion, policyVersion: validation.policyVersion, promptVersion: validation.promptVersion, modelExecutionRef: null,
    parentArtifactId: validation.sourceSubmissionValidationId, createdAt: input.now, corpusId: validation.corpusId, topicId: validation.topicId, runId: validation.runId, generation: validation.generation,
    executionMode: "SHADOW", publicationEligible: false, governanceSubmissionAllowed: false, immutable: true,
    sourceSubmissionValidationId: validation.sourceSubmissionValidationId, sourceSubmissionCandidateId: validation.sourceSubmissionCandidateId,
    originalOperationId: validation.originalOperationId, originalFailureRecordId: validation.originalFailureRecordId,
    topicAuthoritySetId: validation.topicAuthoritySetId, publisherVersionId: validation.publisherVersionId,
    state: input.state, sourceId: source?.sourceId || null, sourceSnapshotId: snapshot?.sourceSnapshotId || null,
    retrievalDisposition: snapshot?.retrievalDisposition || null, rejectionCode: input.rejectionCode || null,
    qualifyingEvidence: false, reentryAuthorized: false
  });
}

/** Internal worker-only handoff. It deliberately has no HTTP/admin entry point. */
export async function retrieveSubmittedSourceCandidate(input: {
  repository: V2FirestoreRepository;
  candidateId: string;
  now?: () => Date;
  retrieval?: RetrievalDependencies;
}): Promise<SourceSubmissionRetrieval> {
  const now = input.now || (() => new Date());
  const prepared = await input.repository.prepareSourceSubmissionRetrieval(input.candidateId, now().toISOString());
  const candidate = sourceSubmissionCandidateSchema.parse(prepared.candidate);
  const publisher = prepared.publisher;
  try {
    const acquired = await retrieveSource({
      context: { corpusId: candidate.corpusId, topicId: candidate.topicId, runId: candidate.runId, generation: candidate.generation, createdAt: now().toISOString() },
      url: candidate.submittedUrl, titleHint: "Operator-submitted governed source", publisherId: publisher.publisherId,
      sourceClass: provisionalSourceClass(publisher), primarySecondaryRole: publisher.primarySecondaryTendency, languageHint: publisher.languages[0]!
    }, input.retrieval);
    const authorityMatches = sourceSubmissionUrlMatchesAuthority({ submittedUrl: acquired.source.canonicalUrl, boundPublisherVersionIds: [publisher.publisherVersionId], publisherVersionId: publisher.publisherVersionId, knownDomains: publisher.knownDomains });
    const usable = authorityMatches && acquired.snapshot.retrievalDisposition === "NEWLY_RETRIEVED" && acquired.snapshot.accessLimitations.length === 0 && acquired.evidenceSegments.length > 0;
    const source = sourceDocumentSchema.parse({ ...acquired.source, publisherId: publisher.publisherId, sourceClass: provisionalSourceClass(publisher), primarySecondaryRole: publisher.primarySecondaryTendency, authorityDomains: publisher.authorityDomains });
    const result = buildSourceSubmissionRetrieval({ validation: prepared.validation, state: usable ? "RETRIEVED_UNQUALIFIED" : "RETRIEVAL_REJECTED", now: now().toISOString(), source, snapshot: acquired.snapshot, rejectionCode: usable ? null : authorityMatches ? "SOURCE_SUBMISSION_INSUFFICIENT_MATERIAL" : "SOURCE_SUBMISSION_REDIRECT_OUTSIDE_AUTHORITY" });
    await input.repository.persistSourceSubmissionRetrieval({ result, source, snapshot: acquired.snapshot, evidenceSegments: acquired.evidenceSegments });
    return result;
  } catch (error) {
    const result = buildSourceSubmissionRetrieval({ validation: prepared.validation, state: "RETRIEVAL_REJECTED", now: now().toISOString(), rejectionCode: rejectionCode(error) });
    await input.repository.persistSourceSubmissionRetrieval({ result });
    return result;
  }
}

export type SourceSubmissionRetrievalArtifacts = { source?: SourceDocument; snapshot?: SourceSnapshot; evidenceSegments?: EvidenceSegment[] };
