import { z } from "zod";

export const V2_SCHEMA_VERSION = "factory-v2-a.3";
export const V2_POLICY_VERSION = "evidence-first-v2-a.10";
export const V2_PROMPT_VERSION = "factory-v2-a-prompts.8";

export const boundedText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
export const idSchema = z.string().trim().min(3).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const corpusIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/u);
export const languageSchema = z.string().trim().min(2).max(35);
export const httpsUrlSchema = z.string().url().max(4096).refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "A credential-free HTTPS URL is required.");

export const historicalDateSchema = z.object({
  year: z.number().int().min(-10000).max(3000),
  month: z.number().int().min(1).max(12).nullable(),
  day: z.number().int().min(1).max(31).nullable(),
  precision: z.enum(["DAY", "MONTH", "YEAR", "APPROXIMATE"]),
  earliestYear: z.number().int().min(-10000).max(3000).nullable(),
  latestYear: z.number().int().min(-10000).max(3000).nullable(),
  label: boundedText(1, 160)
}).strict().superRefine((date, context) => {
  if (date.year === 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ["year"], message: "Historical dates have no year zero." });
  if (date.precision === "DAY" && (date.month === null || date.day === null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["precision"], message: "DAY precision requires month and day." });
  if (date.precision === "MONTH" && (date.month === null || date.day !== null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["precision"], message: "MONTH precision requires month and no day." });
  if ((date.precision === "YEAR" || date.precision === "APPROXIMATE") && (date.month !== null || date.day !== null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["precision"], message: "Coarse precision cannot contain manufactured month/day values." });
  if ((date.earliestYear === null) !== (date.latestYear === null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["earliestYear"], message: "Temporal uncertainty requires both bounds." });
  if (date.earliestYear !== null && date.latestYear !== null && date.earliestYear > date.latestYear) context.addIssue({ code: z.ZodIssueCode.custom, path: ["earliestYear"], message: "Earliest uncertainty bound must not exceed latest." });
});

export const modelExecutionRefSchema = z.object({
  executionId: idSchema,
  model: boundedText(2, 160),
  location: boundedText(2, 80),
  promptVersion: boundedText(2, 120),
  promptHash: hashSchema,
  responseHash: hashSchema
}).strict();

export const immutableEnvelopeFields = {
  artifactId: idSchema,
  schemaVersion: z.literal(V2_SCHEMA_VERSION),
  policyVersion: boundedText(2, 120),
  promptVersion: boundedText(2, 120).nullable(),
  modelExecutionRef: modelExecutionRefSchema.nullable(),
  parentArtifactId: idSchema.nullable(),
  payloadHash: hashSchema,
  createdAt: z.string().datetime(),
  corpusId: corpusIdSchema,
  topicId: idSchema,
  runId: idSchema,
  generation: z.number().int().positive(),
  executionMode: z.literal("SHADOW"),
  publicationEligible: z.literal(false),
  governanceSubmissionAllowed: z.literal(false),
  immutable: z.literal(true)
} as const;

export const immutableEnvelopeSchema = z.object(immutableEnvelopeFields).strict();

export type HistoricalDate = z.infer<typeof historicalDateSchema>;
export type ModelExecutionRef = z.infer<typeof modelExecutionRefSchema>;
