import { z } from "zod";

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

export const autonomousTerminalOutcomeSchema = z.object({
  policyVersion: z.literal(AUTONOMOUS_OUTCOME_POLICY_VERSION),
  classification: z.enum(autonomousTerminalOutcomeClasses),
  disposition: z.enum(autonomousOutcomeDispositions),
  reentryState: z.enum(autonomousReentryStates),
  /** A precise, existing failure class or the validated CKS terminal state. */
  detailedReason: z.string().min(2).max(160),
  /** Present only when the bounded evidence process established the required basis. */
  publicEvidenceBasis: z.enum(["GOVERNED_CAPACITY_EXHAUSTED"]).nullable()
}).strict().superRefine((outcome, context) => {
  const invalid = (field: keyof typeof outcome, message: string) => context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
  if (outcome.classification === "PUBLIC_EVIDENCE_LIMITATION") {
    if (outcome.publicEvidenceBasis === null) invalid("publicEvidenceBasis", "Public evidence limitation requires a bounded evidence basis.");
    if (outcome.disposition !== "DEFERRED") invalid("disposition", "Public evidence limitation must defer rather than fail or complete.");
    if (outcome.reentryState !== "REQUIRES_RELEVANT_CHANGE") invalid("reentryState", "Public evidence limitation requires a relevant-change re-entry gate.");
    return;
  }
  if (outcome.publicEvidenceBasis !== null) invalid("publicEvidenceBasis", "Only public evidence limitation may carry a public evidence basis.");
  if (outcome.classification === "RESEARCH_BUDGET_EXHAUSTED") {
    if (outcome.disposition !== "DEFERRED") invalid("disposition", "Research budget exhaustion must defer.");
    if (outcome.reentryState !== "REQUIRES_AUTHORIZED_RETRY") invalid("reentryState", "Research budget exhaustion requires an authorized retry.");
    return;
  }
  if (outcome.classification === "VALID_COMPLETED_KNOWLEDGE_SET") {
    if (outcome.disposition !== "COMPLETED") invalid("disposition", "A valid Completed Knowledge Set is the only completed autonomous outcome.");
    if (outcome.reentryState !== "NOT_APPLICABLE") invalid("reentryState", "Completed knowledge has no re-entry state.");
    return;
  }
  if (outcome.disposition !== "FAILED") invalid("disposition", "Implementation and provider infrastructure failures must fail rather than defer.");
  if (outcome.reentryState !== "NOT_APPLICABLE") invalid("reentryState", "Implementation and provider infrastructure failures use their existing retry controls.");
});

export type AutonomousTerminalOutcome = z.infer<typeof autonomousTerminalOutcomeSchema>;

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
