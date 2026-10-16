import assert from "node:assert/strict";
import test from "node:test";
import { parseSealedArtifact, immutableEnvelope } from "./contracts/builders";
import { v2FailureRecordSchema } from "./contracts/knowledge";
import { deriveSourceSubmissionCandidate, inspectSourceSubmissionCandidate, listSourceSubmissionCandidates } from "./source-submission";
import { buildSourceSubmissionAuthorityValidation } from "./source-submission-validation";
import { buildSourceSubmissionRetrieval } from "./source-submission-retrieval";
import { sourceSubmissionRetrievalSchema } from "./contracts/source-submission-retrieval";

const context = { corpusId: "submission-corpus", topicId: "submission-topic", runId: "submission-run", generation: 1, createdAt: "2026-10-16T03:00:00.000Z" };
const outcome = { policyVersion: "autonomous-public-evidence.1" as const, classification: "PUBLIC_EVIDENCE_LIMITATION" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_RELEVANT_CHANGE" as const, detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" as const };
const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, "submission-failure"), failureRecordId: "submission-failure", stage: "A2_SCOPE_ACQUISITION", failureClass: "FAILED_UNCLASSIFIED", severity: "HIGH", retryable: false, message: "Governed evidence is unavailable.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 1, budgetConsumed: {}, autonomousOutcome: outcome });
const operation = { operationId: context.runId, corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: 1, pipelineVersion: "factory-v2-a.70" as const, executionMode: "SHADOW" as const, state: "DEFERRED" as const, stage: "A2_SCOPE_ACQUISITION" as const, scopeState: "LOCKED", researchMapState: "VALID", currentBlockingReason: "capacity", counts: {}, budgetsConsumed: {}, elapsedMs: 1, finalVerdict: "FAIL" as const, terminalFailureRecordId: failure.failureRecordId, topicAuthoritySetId: "authority-set-submission", autonomousOutcome: outcome, updatedAt: context.createdAt };

test("source submission remains an immutable candidate and cannot become a snapshot", () => {
  const candidate = deriveSourceSubmissionCandidate({ operation, failure, submittedUrl: "https://example.org/new-source", rationale: "This newly available public source may address the unresolved obligation.", submittedBy: "operator-001", now: "2026-10-16T03:01:00.000Z" });
  assert.equal(candidate.state, "CANDIDATE");
  assert.equal(candidate.sourceSnapshotId, null);
  assert.equal(candidate.publicationEligible, false);
  const validation = buildSourceSubmissionAuthorityValidation({ candidate, operation, publisherVersionId: "publisher-version-submission", now: "2026-10-16T03:02:00.000Z" });
  assert.equal(validation.qualifyingEvidence, false);
  assert.equal(validation.sourceSnapshotId, null);
  const retrieval = buildSourceSubmissionRetrieval({ validation, state: "RETRIEVED_UNQUALIFIED", now: "2026-10-16T03:03:00.000Z", source: { sourceId: "source-submission" }, snapshot: { sourceSnapshotId: "snapshot-submission", retrievalDisposition: "NEWLY_RETRIEVED" } });
  assert.equal(retrieval.qualifyingEvidence, false);
  assert.equal(retrieval.reentryAuthorized, false);
  const rejectedRetrieval = buildSourceSubmissionRetrieval({ validation, state: "RETRIEVAL_REJECTED", now: "2026-10-16T03:04:00.000Z", source: { sourceId: "source-submission" }, snapshot: { sourceSnapshotId: "snapshot-submission", retrievalDisposition: "ACCESS_LIMITED" }, rejectionCode: "SOURCE_SUBMISSION_INSUFFICIENT_MATERIAL" });
  assert.equal(rejectedRetrieval.sourceSnapshotId, "snapshot-submission");
  assert.equal(rejectedRetrieval.qualifyingEvidence, false);
  assert.equal(rejectedRetrieval.reentryAuthorized, false);
  assert.throws(() => buildSourceSubmissionRetrieval({ validation, state: "RETRIEVED_UNQUALIFIED", now: "2026-10-16T03:03:00.000Z" }), /Retrieved observations require complete snapshot lineage/);
  assert.equal(sourceSubmissionRetrievalSchema.safeParse({ ...rejectedRetrieval, sourceId: null, sourceSnapshotId: null, retrievalDisposition: "ACCESS_LIMITED" }).success, false);
  assert.equal(sourceSubmissionRetrievalSchema.safeParse({ ...rejectedRetrieval, retrievalDisposition: null }).success, false);
  assert.throws(() => deriveSourceSubmissionCandidate({ operation: { ...operation, state: "FAILED" }, failure, submittedUrl: "https://example.org/new-source", rationale: "This newly available public source may address the unresolved obligation.", submittedBy: "operator-001", now: "2026-10-16T03:01:00.000Z" }), /exact deferred/);
  assert.throws(() => deriveSourceSubmissionCandidate({ operation: { ...operation, autonomousOutcome: { ...outcome, classification: "RESEARCH_BUDGET_EXHAUSTED", reentryState: "REQUIRES_AUTHORIZED_RETRY", publicEvidenceBasis: null } }, failure, submittedUrl: "https://example.org/new-source", rationale: "This newly available public source may address the unresolved obligation.", submittedBy: "operator-001", now: "2026-10-16T03:01:00.000Z" }), /only for matching public-evidence/);
});

test("source submission inspection exposes only sealed operational observations", async () => {
  const candidate = deriveSourceSubmissionCandidate({ operation, failure, submittedUrl: "https://example.org/recorded-source", rationale: "This newly available public source may address the unresolved obligation.", submittedBy: "operator-001", now: "2026-10-16T03:01:00.000Z" });
  const validation = buildSourceSubmissionAuthorityValidation({ candidate, operation, publisherVersionId: "publisher-version-submission", now: "2026-10-16T03:02:00.000Z" });
  const retrieval = buildSourceSubmissionRetrieval({ validation, state: "RETRIEVAL_REJECTED", now: "2026-10-16T03:03:00.000Z", source: { sourceId: "source-submission" }, snapshot: { sourceSnapshotId: "snapshot-submission", retrievalDisposition: "ACCESS_LIMITED" }, rejectionCode: "SOURCE_SUBMISSION_INSUFFICIENT_MATERIAL" });
  const repository = {
    async getById() { return { id: candidate.sourceSubmissionCandidateId, ...candidate }; },
    async boundedQuery(name: string) {
      if (name === "v2SourceSubmissionValidations") return [{ id: validation.sourceSubmissionValidationId, ...validation }];
      if (name === "v2SourceSubmissionRetrievals") return [{ id: retrieval.sourceSubmissionRetrievalId, ...retrieval }];
      throw new Error(`Unexpected collection: ${name}`);
    }
  } as any;

  const inspection = await inspectSourceSubmissionCandidate(repository, candidate.sourceSubmissionCandidateId);

  assert.deepEqual(inspection, {
    candidateId: candidate.sourceSubmissionCandidateId,
    state: "CANDIDATE",
    submittedAt: "2026-10-16T03:01:00.000Z",
    validation: { state: "AUTHORITY_ELIGIBLE", recordedAt: "2026-10-16T03:02:00.000Z" },
    retrieval: { state: "RETRIEVAL_REJECTED", recordedAt: "2026-10-16T03:03:00.000Z", retrievalDisposition: "ACCESS_LIMITED", rejectionCode: "SOURCE_SUBMISSION_INSUFFICIENT_MATERIAL" },
    qualifyingEvidence: false,
    reentryAuthorized: false
  });
  assert.equal("sourceSnapshotId" in inspection, false);
  assert.equal("sourceId" in inspection, false);
});

test("source submission inspection fails closed on unsealed observation lineage", async () => {
  const candidate = deriveSourceSubmissionCandidate({ operation, failure, submittedUrl: "https://example.org/recorded-source", rationale: "This newly available public source may address the unresolved obligation.", submittedBy: "operator-001", now: "2026-10-16T03:01:00.000Z" });
  const validation = buildSourceSubmissionAuthorityValidation({ candidate, operation, publisherVersionId: "publisher-version-submission", now: "2026-10-16T03:02:00.000Z" });
  const retrieval = buildSourceSubmissionRetrieval({ validation, state: "RETRIEVAL_REJECTED", now: "2026-10-16T03:03:00.000Z", rejectionCode: "SOURCE_SUBMISSION_INSUFFICIENT_MATERIAL" });
  const candidateRecord = { id: candidate.sourceSubmissionCandidateId, ...candidate };

  const repositoryWithoutValidation = {
    async getById() { return candidateRecord; },
    async boundedQuery(name: string) {
      if (name === "v2SourceSubmissionValidations") return [];
      if (name === "v2SourceSubmissionRetrievals") return [{ id: retrieval.sourceSubmissionRetrievalId, ...retrieval }];
      throw new Error(`Unexpected collection: ${name}`);
    }
  } as any;
  await assert.rejects(inspectSourceSubmissionCandidate(repositoryWithoutValidation, candidate.sourceSubmissionCandidateId), /no matching authority validation/);

  const repositoryWithMismatchedObservationDocument = {
    async getById() { return candidateRecord; },
    async boundedQuery(name: string) {
      if (name === "v2SourceSubmissionValidations") return [{ id: "validation-document-mismatch", ...validation }];
      if (name === "v2SourceSubmissionRetrievals") return [];
      throw new Error(`Unexpected collection: ${name}`);
    }
  } as any;
  await assert.rejects(inspectSourceSubmissionCandidate(repositoryWithMismatchedObservationDocument, candidate.sourceSubmissionCandidateId), /validation document identity/);
});

test("source submission candidate list applies server-owned newest-first ordering before its bound", async () => {
  const candidate = deriveSourceSubmissionCandidate({ operation, failure, submittedUrl: "https://example.org/ordered-source", rationale: "This newly available public source may address the unresolved obligation.", submittedBy: "operator-001", now: "2026-10-16T03:01:00.000Z" });
  const calls: unknown[][] = [];
  const repository = {
    async boundedQuery(...args: unknown[]) {
      calls.push(args);
      return [{ id: candidate.sourceSubmissionCandidateId, ...candidate }];
    }
  } as any;

  const summaries = await listSourceSubmissionCandidates(repository, 1_000);

  assert.deepEqual(calls, [["v2SourceSubmissionCandidates", [], 100, { field: "createdAt", direction: "desc" }]]);
  assert.deepEqual(summaries, [{ candidateId: candidate.sourceSubmissionCandidateId, operationId: candidate.originalOperationId, submittedUrl: candidate.submittedUrl, rationale: candidate.rationale, submittedBy: candidate.submittedBy, createdAt: candidate.createdAt, state: "CANDIDATE" }]);
});
