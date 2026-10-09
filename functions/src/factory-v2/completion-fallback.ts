/** Deterministic policy for the single evidence-derived completion round.
 * It never expands a candidate pool: callers supply only sealed, already
 * Registry-bound candidates and invoke it after each attempted candidate. */
export type CompletionYield = "QUALIFYING_EVIDENCE" | "ZERO_CLAIM_YIELD" | "CLAIMS_INADMISSIBLE" | "RETRIEVAL_FAILED" | "SECURITY_REJECTED" | "BUDGET_EXHAUSTED" | "DEADLINE_EXHAUSTED";
export type CompletionFallbackDecision = "STOP_QUALIFYING_EVIDENCE" | "STOP_INADMISSIBLE_CLAIMS" | "TRY_NEXT_SEALED_CANDIDATE" | "STOP_CANDIDATES_EXHAUSTED" | "STOP_BUDGET_OR_DEADLINE" | "STOP_SECURITY_FAIL_CLOSED";

export function decideCompletionFallback(input: { yield: CompletionYield; sealedCandidatesRemaining: number }): CompletionFallbackDecision {
  if (input.yield === "QUALIFYING_EVIDENCE") return "STOP_QUALIFYING_EVIDENCE";
  if (input.yield === "CLAIMS_INADMISSIBLE") return "STOP_INADMISSIBLE_CLAIMS";
  if (input.yield === "SECURITY_REJECTED") return "STOP_SECURITY_FAIL_CLOSED";
  if (input.yield === "BUDGET_EXHAUSTED" || input.yield === "DEADLINE_EXHAUSTED") return "STOP_BUDGET_OR_DEADLINE";
  return input.sealedCandidatesRemaining > 0 ? "TRY_NEXT_SEALED_CANDIDATE" : "STOP_CANDIDATES_EXHAUSTED";
}

/** A successful retrieval with no accepted, question-bound atomic claim is a
 * zero-yield outcome; malformed/rejected claims retain their distinct state. */
export function classifyCompletionYield(input: { retrieved: boolean; securityRejected: boolean; deadlineExceeded: boolean; budgetExhausted: boolean; admissibleGapClaims: number; rejectedClaims: number }): CompletionYield {
  if (input.securityRejected) return "SECURITY_REJECTED";
  if (input.deadlineExceeded) return "DEADLINE_EXHAUSTED";
  if (input.budgetExhausted) return "BUDGET_EXHAUSTED";
  if (!input.retrieved) return "RETRIEVAL_FAILED";
  if (input.admissibleGapClaims > 0) return "QUALIFYING_EVIDENCE";
  return input.rejectedClaims > 0 ? "CLAIMS_INADMISSIBLE" : "ZERO_CLAIM_YIELD";
}
