import assert from "node:assert/strict";
import test from "node:test";
import { parseSealedArtifact } from "./builders";
import { deferredReentryRequestSchema } from "./reentry";

const base = {
  artifactId: "reentry-request-001", schemaVersion: "factory-v2-a.15", policyVersion: "authority-first-research.43", promptVersion: null, modelExecutionRef: null, parentArtifactId: "failure-record-001", createdAt: "2026-10-16T00:00:00.000Z",
  corpusId: "test-clean-corpus", topicId: "topic-001", runId: "run-reentry-002", generation: 2, executionMode: "SHADOW" as const, publicationEligible: false as const, governanceSubmissionAllowed: false as const, immutable: true as const,
  deferredReentryRequestId: "reentry-request-001", originalFailureRecordId: "failure-record-001", originalOperationId: "operation-001", originalRunId: "run-original-001", originalGeneration: 1, nextRunId: "run-reentry-002", nextGeneration: 2,
  originalRelease: { pipelineVersion: "factory-v2-a.70", schemaVersion: "factory-v2-a.15", policyVersion: "authority-first-research.43", promptVersion: "factory-v2-a-prompts.21" },
  outcome: { policyVersion: "autonomous-public-evidence.1", classification: "PUBLIC_EVIDENCE_LIMITATION" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_RELEVANT_CHANGE" as const, detailedReason: "FAILED_UNCLASSIFIED", publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" },
  trigger: "RELEVANT_EVIDENCE_CHANGE" as const, relevantChangeArtifactId: "governed-change-001", authorizedBy: null, state: "REQUESTED" as const
};

test("deferred re-entry is immutable, one-generation, and condition-bound", () => {
  assert.equal(parseSealedArtifact(deferredReentryRequestSchema, base).nextRunId, "run-reentry-002");
  assert.equal(deferredReentryRequestSchema.safeParse({ ...base, nextGeneration: 3, generation: 3 }).success, false);
  assert.equal(deferredReentryRequestSchema.safeParse({ ...base, originalRelease: { ...base.originalRelease, policyVersion: "authority-first-research.42" } }).success, false);
  assert.equal(deferredReentryRequestSchema.safeParse({ ...base, trigger: "AUTHORIZED_RETRY", relevantChangeArtifactId: null, authorizedBy: "operator-001" }).success, false);
  const budgetRetry = { ...base, outcome: { ...base.outcome, classification: "RESEARCH_BUDGET_EXHAUSTED" as const, reentryState: "REQUIRES_AUTHORIZED_RETRY" as const, publicEvidenceBasis: null }, trigger: "AUTHORIZED_RETRY" as const, relevantChangeArtifactId: null, authorizedBy: "operator-001" };
  assert.equal(parseSealedArtifact(deferredReentryRequestSchema, budgetRetry).trigger, "AUTHORIZED_RETRY");
});
