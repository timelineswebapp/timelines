import assert from "node:assert/strict";
import test from "node:test";
import { sourceSubmissionDispatchSchema } from "./source-submission-dispatch";
import { dispatchSourceSubmissionRetrieval } from "./source-submission-dispatch";
import { bootstrapPublisherRegistry } from "./authority";
import { buildSourceSubmissionAuthorityValidation } from "./source-submission-validation";
import { deriveSourceSubmissionCandidate } from "./source-submission";
import { immutableEnvelope, parseSealedArtifact } from "./contracts/builders";
import { v2FailureRecordSchema } from "./contracts/knowledge";

test("source submission dispatch requires bounded candidate identity and a sealed timestamp", () => {
  assert.equal(sourceSubmissionDispatchSchema.parse({ candidateId: "candidate-001", dispatchedAt: "2026-10-16T04:00:00.000Z" }).candidateId, "candidate-001");
  assert.throws(() => sourceSubmissionDispatchSchema.parse({ candidateId: "candidate-001" }), /dispatchedAt/);
  assert.throws(() => sourceSubmissionDispatchSchema.parse({ candidateId: "invalid id", dispatchedAt: "2026-10-16T04:00:00.000Z" }), /Invalid/);
  assert.throws(() => sourceSubmissionDispatchSchema.parse({ candidateId: "candidate-001", dispatchedAt: "2026-10-16T04:00:00.000Z", sourceUrl: "https://untrusted.example" }), /Unrecognized key/);
});

test("dispatch persists a retrieval rejection without accepting caller acquisition input", async () => {
  const context = { corpusId: "dispatch-corpus", topicId: "dispatch-topic", runId: "dispatch-run", generation: 1, createdAt: "2026-10-16T04:00:00.000Z" };
  const outcome = { policyVersion: "autonomous-public-evidence.1" as const, classification: "PUBLIC_EVIDENCE_LIMITATION" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_RELEVANT_CHANGE" as const, detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" as const };
  const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, "dispatch-failure"), failureRecordId: "dispatch-failure", stage: "A2_SCOPE_ACQUISITION", failureClass: "FAILED_UNCLASSIFIED", severity: "HIGH", retryable: false, message: "No governed source.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 1, budgetConsumed: {}, autonomousOutcome: outcome });
  const operation = { operationId: context.runId, corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: 1, pipelineVersion: "factory-v2-a.70" as const, executionMode: "SHADOW" as const, state: "DEFERRED" as const, stage: "A2_SCOPE_ACQUISITION" as const, scopeState: "LOCKED", researchMapState: "VALID", currentBlockingReason: "capacity", counts: {}, budgetsConsumed: {}, elapsedMs: 1, finalVerdict: "FAIL" as const, terminalFailureRecordId: failure.failureRecordId, topicAuthoritySetId: "dispatch-authority", autonomousOutcome: outcome, updatedAt: context.createdAt };
  const candidate = deriveSourceSubmissionCandidate({ operation, failure, submittedUrl: "https://www.bl.uk/dispatch", rationale: "A registered authority URL may address the unresolved obligation.", submittedBy: "operator-dispatch", now: context.createdAt });
  const publisher = bootstrapPublisherRegistry(context).find((item) => item.canonicalName === "British Library")!;
  const validation = buildSourceSubmissionAuthorityValidation({ candidate, operation, publisherVersionId: publisher.publisherVersionId, now: context.createdAt });
  let persisted: unknown;
  const repository = { async prepareSourceSubmissionRetrieval() { return { candidate, validation, publisher }; }, async persistSourceSubmissionRetrieval(input: unknown) { persisted = input; } } as any;
  const result = await dispatchSourceSubmissionRetrieval({ candidateId: candidate.sourceSubmissionCandidateId, dispatchedAt: context.createdAt }, repository, { dnsLookup: (async () => [{ address: "93.184.216.34", family: 4 }]) as never, fetch: async () => { throw new Error("SOURCE_RETRIEVAL_TEST_FAILURE"); } });
  assert.equal(result.state, "RETRIEVAL_REJECTED");
  assert.equal((persisted as { result: { qualifyingEvidence: boolean } }).result.qualifyingEvidence, false);
});
