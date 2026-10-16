import { z } from "zod";
import { autonomousTerminalOutcomeSchema } from "../autonomous-outcomes";
import { boundedText, executionEnvelopeFields, idSchema, V2_PIPELINE_VERSION, V2_SCHEMA_VERSION } from "./common";

/**
 * An immutable authorization to create one new, release-pinned Factory attempt.
 * This is deliberately not a queue task: a separate dispatcher must validate
 * and consume it atomically before it can execute any research.
 */
export const deferredReentryRequestSchema = z.object({
  ...executionEnvelopeFields,
  deferredReentryRequestId: idSchema,
  originalFailureRecordId: idSchema,
  originalOperationId: idSchema,
  originalRunId: idSchema,
  originalGeneration: z.number().int().positive(),
  nextRunId: idSchema,
  nextGeneration: z.number().int().positive(),
  originalRelease: z.object({
    pipelineVersion: z.literal(V2_PIPELINE_VERSION),
    schemaVersion: z.literal(V2_SCHEMA_VERSION),
    policyVersion: boundedText(2, 120),
    promptVersion: boundedText(2, 120).nullable()
  }).strict(),
  outcome: autonomousTerminalOutcomeSchema,
  trigger: z.enum(["RELEVANT_EVIDENCE_CHANGE", "AUTHORIZED_RETRY"]),
  relevantChangeArtifactId: idSchema.nullable(),
  authorizedBy: boundedText(2, 240).nullable(),
  state: z.literal("REQUESTED")
}).strict().superRefine((request, context) => {
  if (request.outcome.disposition !== "DEFERRED") context.addIssue({ code: z.ZodIssueCode.custom, path: ["outcome"], message: "Only deferred outcomes may request re-entry." });
  if (request.originalRunId === request.nextRunId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["nextRunId"], message: "Re-entry must use a new run identity." });
  if (request.nextGeneration !== request.originalGeneration + 1 || request.generation !== request.nextGeneration) context.addIssue({ code: z.ZodIssueCode.custom, path: ["nextGeneration"], message: "Re-entry advances exactly one generation." });
  if (request.originalRelease.schemaVersion !== request.schemaVersion || request.originalRelease.policyVersion !== request.policyVersion) context.addIssue({ code: z.ZodIssueCode.custom, path: ["originalRelease"], message: "Re-entry release must exactly match its immutable envelope." });
  if (request.outcome.reentryState === "REQUIRES_RELEVANT_CHANGE" && (request.trigger !== "RELEVANT_EVIDENCE_CHANGE" || request.relevantChangeArtifactId === null || request.authorizedBy !== null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["trigger"], message: "Evidence limitations require a governed relevant-change artifact, not an authorization retry." });
  if (request.outcome.reentryState === "REQUIRES_AUTHORIZED_RETRY" && (request.trigger !== "AUTHORIZED_RETRY" || request.authorizedBy === null || request.relevantChangeArtifactId !== null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["trigger"], message: "Budget exhaustion requires an explicit bounded retry authorization." });
});

export type DeferredReentryRequest = z.infer<typeof deferredReentryRequestSchema>;
