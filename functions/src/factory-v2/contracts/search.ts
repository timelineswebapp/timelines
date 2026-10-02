import { z } from "zod";
import { boundedText, executionEnvelopeFields, httpsUrlSchema, idSchema } from "./common";
import { sourceClassSchema } from "./knowledge";

const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const queryRoleSchema = z.enum(["ORIENTATION", "PHASE_DIMENSION", "AUTHORITY_TARGETED"]);
export const queryCriticalitySchema = z.enum(["CRITICAL", "IMPORTANT", "SUPPORTING"]);

export const searchQueryLedgerEntrySchema = z.object({
  queryId: idSchema,
  researchQuestionIds: z.array(idSchema).min(1).max(20).refine(unique),
  gapIds: z.array(idSchema).max(20).refine(unique),
  phaseIds: z.array(idSchema).min(1).max(24).refine(unique),
  dimensionIds: z.array(idSchema).min(1).max(20).refine(unique),
  language: boundedText(2, 35),
  geography: z.array(boundedText(1, 160)).min(1).max(8).refine(unique),
  proposedText: boundedText(3, 500),
  normalizedText: boundedText(3, 500),
  role: queryRoleSchema,
  intendedSourceClass: sourceClassSchema,
  criticality: queryCriticalitySchema,
  authorizationStatus: z.enum(["AUTHORIZED", "REJECTED"]),
  rejectionReason: z.enum(["DUPLICATE_NORMALIZED_QUERY", "BUDGET_PRIORITY_EXCLUDED"]).nullable(),
  executionStatus: z.enum(["NOT_AUTHORIZED", "PENDING", "SUCCEEDED", "FAILED"]),
  searchProvider: z.literal("BRAVE_SEARCH_API"),
  providerCallId: boundedText(1, 200).nullable(),
  latencyMs: z.number().int().nonnegative().max(300_000).nullable(),
  returnedResultCount: z.number().int().nonnegative().max(20).nullable(),
  resultUrls: z.array(httpsUrlSchema).max(20).refine(unique),
  transportAttempts: z.number().int().min(0).max(2),
  quotaUnits: z.number().int().min(0).max(2),
  monetaryCostUsd: z.number().nonnegative().max(1).nullable()
}).strict().superRefine((entry, context) => {
  if (entry.authorizationStatus === "REJECTED" && entry.rejectionReason === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "Rejected queries require a reason." });
  if (entry.authorizationStatus === "AUTHORIZED" && entry.rejectionReason !== null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "Authorized queries cannot have rejection reasons." });
  if (entry.authorizationStatus === "REJECTED" && entry.executionStatus !== "NOT_AUTHORIZED") context.addIssue({ code: z.ZodIssueCode.custom, path: ["executionStatus"], message: "Rejected queries cannot execute." });
  if (["SUCCEEDED", "FAILED"].includes(entry.executionStatus) && entry.authorizationStatus !== "AUTHORIZED") context.addIssue({ code: z.ZodIssueCode.custom, path: ["executionStatus"], message: "Only authorized queries may execute." });
});

export const searchQueryLedgerSchema = z.object({
  ...executionEnvelopeFields,
  queryLedgerId: idSchema,
  researchMapIds: z.array(idSchema).min(1).max(2).refine(unique),
  queryPlanIds: z.array(idSchema).min(1).max(2).refine(unique),
  ledgerScope: z.enum(["ACQUISITION_ROUND", "COMPLETED_KNOWLEDGE_SET_ACQUISITION"]),
  maximumAuthorizedQueries: z.literal(25),
  proposedCount: z.number().int().nonnegative().max(120),
  authorizedCount: z.number().int().nonnegative().max(25),
  executedCount: z.number().int().nonnegative().max(25),
  rejectedCount: z.number().int().nonnegative().max(120),
  entries: z.array(searchQueryLedgerEntrySchema).max(120)
}).strict().superRefine((ledger, context) => {
  const authorized = ledger.entries.filter((entry) => entry.authorizationStatus === "AUTHORIZED").length;
  const executed = ledger.entries.filter((entry) => ["SUCCEEDED", "FAILED"].includes(entry.executionStatus)).length;
  const rejected = ledger.entries.filter((entry) => entry.authorizationStatus === "REJECTED").length;
  if (ledger.proposedCount !== ledger.entries.length || ledger.authorizedCount !== authorized || ledger.executedCount !== executed || ledger.rejectedCount !== rejected) context.addIssue({ code: z.ZodIssueCode.custom, path: ["entries"], message: "Ledger counters must exactly match entries." });
  if (ledger.executedCount > ledger.authorizedCount || ledger.authorizedCount > ledger.maximumAuthorizedQueries) context.addIssue({ code: z.ZodIssueCode.custom, path: ["authorizedCount"], message: "Executed queries must not exceed authorized queries or the fixed budget." });
});

export type QueryRole = z.infer<typeof queryRoleSchema>;
export type QueryCriticality = z.infer<typeof queryCriticalitySchema>;
export type SearchQueryLedger = z.infer<typeof searchQueryLedgerSchema>;
export type SearchQueryLedgerEntry = z.infer<typeof searchQueryLedgerEntrySchema>;
