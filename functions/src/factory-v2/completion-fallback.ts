/** Deterministic policy for the single evidence-derived completion round.
 * It never expands a candidate pool: callers supply only sealed, already
 * Registry-bound candidates and invoke it after each attempted candidate. */
export type CompletionYield = "QUALIFYING_EVIDENCE" | "ZERO_CLAIM_YIELD" | "CLAIMS_INADMISSIBLE" | "RETRIEVAL_FAILED" | "SECURITY_REJECTED" | "BUDGET_EXHAUSTED" | "DEADLINE_EXHAUSTED";
export type CompletionFallbackDecision = "STOP_QUALIFYING_EVIDENCE" | "STOP_INADMISSIBLE_CLAIMS" | "TRY_NEXT_SEALED_CANDIDATE" | "STOP_CANDIDATES_EXHAUSTED" | "STOP_BUDGET_OR_DEADLINE" | "STOP_SECURITY_FAIL_CLOSED";

export type CompletionAuthorityBinding = {
  bindingId: string;
  publisherVersionId: string;
  researchQuestionIds: readonly string[];
  roles: readonly string[];
  subjectRelationship: string;
  independenceGroupId: string;
  languages: readonly string[];
  geography: readonly string[];
  historicalJurisdictionCapacityIds?: readonly string[];
  validationStatus: "ELIGIBLE" | "INELIGIBLE";
};

export type CompletionAuthorityRequirement = {
  questionId: string;
  gapObligationIds: readonly string[];
  requiredRoles: readonly string[];
  permittedSubjectRelationships: readonly string[];
  minimumIndependentGroups: number;
  languages?: readonly string[];
  geography?: readonly string[];
  historicalJurisdictionCapacityIds?: readonly string[];
};

/** Computes the only authority universe completion may use.  This deliberately
 * consumes bindings, never discovered URLs; URL discovery is evidence
 * acquisition after this universe has been immutably sealed. */
export function sealCompletionAuthorityUniverse(input: {
  bindings: readonly CompletionAuthorityBinding[];
  requirements: readonly CompletionAuthorityRequirement[];
  candidateCeiling: number;
}): Array<{
  questionId: string;
  gapObligationIds: string[];
  authorityBindingId: string;
  publisherVersionId: string;
  candidateRank: number;
  disposition: "ELIGIBLE" | "EXCLUDED_CEILING";
  exclusionReason: "PER_GAP_AUTHORITY_CEILING" | null;
}> {
  const ceiling = Math.min(4, Math.max(1, input.candidateCeiling));
  return input.requirements.flatMap((requirement) => {
    const eligible = input.bindings
      .filter((binding) => binding.validationStatus === "ELIGIBLE"
        && binding.researchQuestionIds.includes(requirement.questionId)
        && binding.roles.some((role) => requirement.requiredRoles.includes(role))
        && requirement.permittedSubjectRelationships.includes(binding.subjectRelationship)
        && (!requirement.languages?.length || requirement.languages.some((language) => binding.languages.includes(language)))
        && (!requirement.geography?.length || requirement.geography.some((geography) => binding.geography.includes(geography)))
        && (!requirement.historicalJurisdictionCapacityIds?.length || requirement.historicalJurisdictionCapacityIds.every((id) => (binding.historicalJurisdictionCapacityIds || []).includes(id))))
      .sort((left, right) => left.publisherVersionId.localeCompare(right.publisherVersionId) || left.bindingId.localeCompare(right.bindingId));
    const independentGroups = new Set(eligible.filter((binding) => binding.subjectRelationship === "INDEPENDENT").map((binding) => binding.independenceGroupId));
    if (requirement.minimumIndependentGroups > 0 && independentGroups.size < requirement.minimumIndependentGroups) return [];
    return eligible.map((binding, index) => ({
      questionId: requirement.questionId,
      gapObligationIds: [...requirement.gapObligationIds].sort(),
      authorityBindingId: binding.bindingId,
      publisherVersionId: binding.publisherVersionId,
      candidateRank: index + 1,
      disposition: index < ceiling ? "ELIGIBLE" as const : "EXCLUDED_CEILING" as const,
      exclusionReason: index < ceiling ? null : "PER_GAP_AUTHORITY_CEILING" as const
    }));
  }).sort((left, right) => left.questionId.localeCompare(right.questionId) || left.candidateRank - right.candidateRank || left.authorityBindingId.localeCompare(right.authorityBindingId));
}

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
