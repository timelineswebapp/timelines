import { v2FailureRecordSchema } from "./contracts/knowledge";
import { topicOperationSchema } from "./contracts/operations";

export type DeferredOperationalFeasibility = {
  state: "REENTRY_CONDITION_REQUIRED";
  requiredCondition: "RELEVANT_EVIDENCE_CHANGE" | "AUTHORIZED_RETRY";
  terminalAt: string;
  attemptsConsumed: number;
  budgetConsumed: Record<string, number>;
  failureClass: string;
};

/**
 * This is an operations-only observation. It intentionally has no priority,
 * significance, coverage, or selection field and cannot alter research work.
 */
export function deriveDeferredOperationalFeasibility(input: { operation: unknown; failure: unknown }): DeferredOperationalFeasibility {
  const operation = topicOperationSchema.parse(input.operation);
  const failure = v2FailureRecordSchema.parse(input.failure);
  if (operation.state !== "DEFERRED" || operation.terminalFailureRecordId !== failure.failureRecordId || operation.topicId !== failure.topicId || operation.runId !== failure.runId || operation.generation !== failure.generation) {
    throw new Error("Operational feasibility requires exact deferred terminal lineage.");
  }
  if (failure.autonomousOutcome === null || JSON.stringify(failure.autonomousOutcome) !== JSON.stringify(operation.autonomousOutcome)) {
    throw new Error("Operational feasibility requires the matching immutable autonomous outcome.");
  }
  const requiredCondition = failure.autonomousOutcome.reentryState === "REQUIRES_RELEVANT_CHANGE"
    ? "RELEVANT_EVIDENCE_CHANGE"
    : failure.autonomousOutcome.reentryState === "REQUIRES_AUTHORIZED_RETRY"
      ? "AUTHORIZED_RETRY"
      : null;
  if (requiredCondition === null) throw new Error("Only deferred outcomes have an operational feasibility condition.");
  return {
    state: "REENTRY_CONDITION_REQUIRED",
    requiredCondition,
    terminalAt: failure.createdAt,
    attemptsConsumed: failure.attemptsConsumed,
    budgetConsumed: failure.budgetConsumed,
    failureClass: failure.failureClass
  };
}
