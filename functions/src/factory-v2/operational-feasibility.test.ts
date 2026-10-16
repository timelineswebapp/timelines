import assert from "node:assert/strict";
import test from "node:test";
import { parseSealedArtifact, immutableEnvelope } from "./contracts/builders";
import { v2FailureRecordSchema } from "./contracts/knowledge";
import { deriveDeferredOperationalFeasibility } from "./operational-feasibility";

const context = { corpusId: "feasibility-corpus", topicId: "feasibility-topic", runId: "feasibility-run", generation: 1, createdAt: "2026-10-16T02:00:00.000Z" };
const outcome = { policyVersion: "autonomous-public-evidence.1" as const, classification: "RESEARCH_BUDGET_EXHAUSTED" as const, disposition: "DEFERRED" as const, reentryState: "REQUIRES_AUTHORIZED_RETRY" as const, detailedReason: "ACQUISITION_BUDGET_EXHAUSTED", publicEvidenceBasis: null };
const failure = parseSealedArtifact(v2FailureRecordSchema, { ...immutableEnvelope(context, "feasibility-failure"), failureRecordId: "feasibility-failure", stage: "A2_SCOPE_ACQUISITION", failureClass: "ACQUISITION_BUDGET_EXHAUSTED", severity: "HIGH", retryable: false, message: "The governed acquisition budget was consumed.", protectedRepresentationDiagnostics: null, blockingArtifactIds: [], attemptsConsumed: 3, budgetConsumed: { providerQueries: 25 }, autonomousOutcome: outcome });
const operation = { operationId: context.runId, corpusId: context.corpusId, topicId: context.topicId, runId: context.runId, generation: 1, pipelineVersion: "factory-v2-a.70" as const, executionMode: "SHADOW" as const, state: "DEFERRED" as const, stage: "A2_SCOPE_ACQUISITION" as const, scopeState: "LOCKED", researchMapState: "VALID", currentBlockingReason: "budget", counts: {}, budgetsConsumed: {}, elapsedMs: 1, finalVerdict: "FAIL" as const, terminalFailureRecordId: failure.failureRecordId, autonomousOutcome: outcome, updatedAt: context.createdAt };

test("operational feasibility reports only re-entry conditions from exact terminal lineage", () => {
  const feasibility = deriveDeferredOperationalFeasibility({ operation, failure });
  assert.deepEqual(feasibility, { state: "REENTRY_CONDITION_REQUIRED", requiredCondition: "AUTHORIZED_RETRY", terminalAt: context.createdAt, attemptsConsumed: 3, budgetConsumed: { providerQueries: 25 }, failureClass: "ACQUISITION_BUDGET_EXHAUSTED" });
  assert.equal("priority" in feasibility, false);
  assert.throws(() => deriveDeferredOperationalFeasibility({ operation: { ...operation, generation: 2 }, failure }), /exact deferred terminal lineage/);
});
