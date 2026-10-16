import assert from "node:assert/strict";
import test from "node:test";
import { V2FirestoreRepository } from "./repositories/firestore";
import { deriveSourceSubmissionCandidate } from "./source-submission";
import { parseSealedArtifact, immutableEnvelope } from "./contracts/builders";
import { v2FailureRecordSchema } from "./contracts/knowledge";

test("source-submission authority resolution rejects a candidate document identity mismatch", async () => {
  const context = { corpusId: "authority-integrity-corpus", topicId: "authority-integrity-topic", runId: "authority-integrity-run", generation: 1, createdAt: "2026-10-16T06:00:00.000Z" };
  const outcome = { policyVersion: "autonomous-public-evidence.1" as const, classification: "PUBLIC_EVIDENCE_LIMITATION" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_RELEVANT_CHANGE" as const, detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" as const };
  const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, "authority-integrity-failure"), failureRecordId: "authority-integrity-failure", stage: "A2_SCOPE_ACQUISITION", failureClass: "FAILED_UNCLASSIFIED", severity: "HIGH", retryable: false, message: "Governed evidence is unavailable.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 1, budgetConsumed: {}, autonomousOutcome: outcome });
  const operation = { operationId: context.runId, corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: context.generation, pipelineVersion: "factory-v2-a.70" as const, executionMode: "SHADOW" as const, state: "DEFERRED" as const, stage: "A2_SCOPE_ACQUISITION" as const, scopeState: "LOCKED", researchMapState: "VALID", currentBlockingReason: "capacity", counts: {}, budgetsConsumed: {}, elapsedMs: 1, finalVerdict: "FAIL" as const, terminalFailureRecordId: failure.failureRecordId, topicAuthoritySetId: "authority-integrity-set", autonomousOutcome: outcome, updatedAt: context.createdAt };
  const candidate = deriveSourceSubmissionCandidate({ operation, failure, submittedUrl: "https://example.org/authority-integrity", rationale: "This newly available public source may address the unresolved obligation.", submittedBy: "operator-001", now: "2026-10-16T06:01:00.000Z" });
  const candidateSnapshot = { exists: true, id: "candidate-document-mismatch", data: () => candidate };
  const firestore = {
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ get: async () => candidateSnapshot }) }) }) })
  };
  const repository = new V2FirestoreRepository({ firestore: firestore as never, corpusId: context.corpusId });

  await assert.rejects(repository.resolveSourceSubmissionAuthority(candidate.sourceSubmissionCandidateId), /candidate integrity/);
});
