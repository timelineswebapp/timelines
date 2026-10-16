import assert from "node:assert/strict";
import test from "node:test";
import { autonomousTerminalOutcomeSchema, classifyAutonomousFailure, validCompletedKnowledgeSetOutcome } from "./autonomous-outcomes";

test("protected governed-capacity exhaustion is the only public-evidence limitation path", () => {
  const outcome = classifyAutonomousFailure({ failureClass: "FAILED_UNCLASSIFIED", protectedRepresentationUnavailable: true });
  assert.deepEqual(outcome, {
    policyVersion: "autonomous-public-evidence.1",
    classification: "PUBLIC_EVIDENCE_LIMITATION",
    disposition: "DEFERRED",
    reentryState: "REQUIRES_RELEVANT_CHANGE",
    detailedReason: "FAILED_UNCLASSIFIED",
    publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED"
  });
});

test("provider and budget outcomes remain distinct from evidence limitations", () => {
  assert.equal(classifyAutonomousFailure({ failureClass: "PROVIDER_FAILURE", protectedRepresentationUnavailable: false }).classification, "PROVIDER_INFRASTRUCTURE_FAILURE");
  const budget = classifyAutonomousFailure({ failureClass: "ACQUISITION_BUDGET_EXHAUSTED", protectedRepresentationUnavailable: false });
  assert.equal(budget.classification, "RESEARCH_BUDGET_EXHAUSTED");
  assert.equal(budget.reentryState, "REQUIRES_AUTHORIZED_RETRY");
  assert.equal(classifyAutonomousFailure({ failureClass: "SECURITY_RETRIEVAL_REJECTED", protectedRepresentationUnavailable: false }).classification, "IMPLEMENTATION_FAILURE");
});

test("completed knowledge is the sole success outcome", () => {
  const outcome = validCompletedKnowledgeSetOutcome();
  assert.equal(outcome.classification, "VALID_COMPLETED_KNOWLEDGE_SET");
  assert.equal(outcome.disposition, "COMPLETED");
});

test("terminal summary invariants reject unproven evidence limitations and unsafe re-entry", () => {
  const publicLimitation = classifyAutonomousFailure({ failureClass: "FAILED_UNCLASSIFIED", protectedRepresentationUnavailable: true });
  assert.equal(autonomousTerminalOutcomeSchema.safeParse({ ...publicLimitation, publicEvidenceBasis: null }).success, false);
  assert.equal(autonomousTerminalOutcomeSchema.safeParse({ ...publicLimitation, reentryState: "REQUIRES_AUTHORIZED_RETRY" }).success, false);
  const completed = validCompletedKnowledgeSetOutcome();
  assert.equal(autonomousTerminalOutcomeSchema.safeParse({ ...completed, disposition: "DEFERRED" }).success, false);
});
