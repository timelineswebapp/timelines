/**
 * TL-AUTONOMY-001 terminal summaries are deliberately additive.  Existing
 * failure classes remain the forensic record; this module supplies the
 * operational disposition without turning a failed URL into a claim that all
 * public evidence is unavailable.
 */
export const AUTONOMOUS_OUTCOME_POLICY_VERSION = "autonomous-public-evidence.1" as const;

export const autonomousTerminalOutcomeClasses = [
  "IMPLEMENTATION_FAILURE",
  "PROVIDER_INFRASTRUCTURE_FAILURE",
  "RESEARCH_BUDGET_EXHAUSTED",
  "PUBLIC_EVIDENCE_LIMITATION",
  "VALID_COMPLETED_KNOWLEDGE_SET"
] as const;
export type AutonomousTerminalOutcomeClass = (typeof autonomousTerminalOutcomeClasses)[number];

export const autonomousOutcomeDispositions = ["FAILED", "DEFERRED", "COMPLETED"] as const;
export type AutonomousOutcomeDisposition = (typeof autonomousOutcomeDispositions)[number];

export const autonomousReentryStates = ["NOT_APPLICABLE", "REQUIRES_RELEVANT_CHANGE", "REQUIRES_AUTHORIZED_RETRY"] as const;
export type AutonomousReentryState = (typeof autonomousReentryStates)[number];

export type AutonomousTerminalOutcome = {
  policyVersion: typeof AUTONOMOUS_OUTCOME_POLICY_VERSION;
  classification: AutonomousTerminalOutcomeClass;
  disposition: AutonomousOutcomeDisposition;
  reentryState: AutonomousReentryState;
  /** A precise, existing failure class or the validated CKS terminal state. */
  detailedReason: string;
  /** Present only when the bounded evidence process established the required basis. */
  publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED" | null;
};

export function classifyAutonomousFailure(input: {
  failureClass: string;
  protectedRepresentationUnavailable: boolean;
}): AutonomousTerminalOutcome {
  if (input.protectedRepresentationUnavailable) {
    return {
      policyVersion: AUTONOMOUS_OUTCOME_POLICY_VERSION,
      classification: "PUBLIC_EVIDENCE_LIMITATION",
      disposition: "DEFERRED",
      reentryState: "REQUIRES_RELEVANT_CHANGE",
      detailedReason: input.failureClass,
      publicEvidenceBasis: "GOVERNED_CAPACITY_EXHAUSTED"
    };
  }
  if (input.failureClass === "PROVIDER_FAILURE") {
    return {
      policyVersion: AUTONOMOUS_OUTCOME_POLICY_VERSION,
      classification: "PROVIDER_INFRASTRUCTURE_FAILURE",
      disposition: "FAILED",
      reentryState: "NOT_APPLICABLE",
      detailedReason: input.failureClass,
      publicEvidenceBasis: null
    };
  }
  if (["ACQUISITION_BUDGET_EXHAUSTED", "WHOLE_RUN_DEADLINE_EXCEEDED"].includes(input.failureClass)) {
    return {
      policyVersion: AUTONOMOUS_OUTCOME_POLICY_VERSION,
      classification: "RESEARCH_BUDGET_EXHAUSTED",
      disposition: "DEFERRED",
      reentryState: "REQUIRES_AUTHORIZED_RETRY",
      detailedReason: input.failureClass,
      publicEvidenceBasis: null
    };
  }
  return {
    policyVersion: AUTONOMOUS_OUTCOME_POLICY_VERSION,
    classification: "IMPLEMENTATION_FAILURE",
    disposition: "FAILED",
    reentryState: "NOT_APPLICABLE",
    detailedReason: input.failureClass,
    publicEvidenceBasis: null
  };
}

export function validCompletedKnowledgeSetOutcome(): AutonomousTerminalOutcome {
  return {
    policyVersion: AUTONOMOUS_OUTCOME_POLICY_VERSION,
    classification: "VALID_COMPLETED_KNOWLEDGE_SET",
    disposition: "COMPLETED",
    reentryState: "NOT_APPLICABLE",
    detailedReason: "VALID_COMPLETED_KNOWLEDGE_SET",
    publicEvidenceBasis: null
  };
}
