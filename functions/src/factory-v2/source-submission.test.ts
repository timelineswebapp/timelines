import assert from "node:assert/strict";
import test from "node:test";
import { parseSealedArtifact, immutableEnvelope } from "./contracts/builders";
import { v2FailureRecordSchema } from "./contracts/knowledge";
import { deriveSourceSubmissionCandidate } from "./source-submission";
import { buildSourceSubmissionAuthorityValidation } from "./source-submission-validation";
import { buildSourceSubmissionRetrieval } from "./source-submission-retrieval";

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
  assert.throws(() => buildSourceSubmissionRetrieval({ validation, state: "RETRIEVED_UNQUALIFIED", now: "2026-10-16T03:03:00.000Z" }), /Retrieved observations require complete snapshot lineage/);
  assert.throws(() => deriveSourceSubmissionCandidate({ operation: { ...operation, state: "FAILED" }, failure, submittedUrl: "https://example.org/new-source", rationale: "This newly available public source may address the unresolved obligation.", submittedBy: "operator-001", now: "2026-10-16T03:01:00.000Z" }), /exact deferred/);
  assert.throws(() => deriveSourceSubmissionCandidate({ operation: { ...operation, autonomousOutcome: { ...outcome, classification: "RESEARCH_BUDGET_EXHAUSTED", reentryState: "REQUIRES_AUTHORIZED_RETRY", publicEvidenceBasis: null } }, failure, submittedUrl: "https://example.org/new-source", rationale: "This newly available public source may address the unresolved obligation.", submittedBy: "operator-001", now: "2026-10-16T03:01:00.000Z" }), /only for matching public-evidence/);
});
