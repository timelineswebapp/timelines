import { z } from "zod";
import { boundedText, executionEnvelopeFields, idSchema } from "./common";

/** A sealed acquisition observation, never a claim, admission, or re-entry authorization. */
export const sourceSubmissionRetrievalSchema = z.object({
  ...executionEnvelopeFields,
  sourceSubmissionRetrievalId: idSchema,
  sourceSubmissionValidationId: idSchema,
  sourceSubmissionCandidateId: idSchema,
  originalOperationId: idSchema,
  originalFailureRecordId: idSchema,
  topicAuthoritySetId: idSchema,
  publisherVersionId: idSchema,
  state: z.enum(["RETRIEVED_UNQUALIFIED", "RETRIEVAL_REJECTED"]),
  sourceId: idSchema.nullable(),
  sourceSnapshotId: idSchema.nullable(),
  retrievalDisposition: z.enum(["NEWLY_RETRIEVED", "CACHE_REUSED", "REVALIDATED", "ACCESS_LIMITED", "UNAVAILABLE"]).nullable(),
  rejectionCode: boundedText(3, 160).nullable(),
  qualifyingEvidence: z.literal(false),
  reentryAuthorized: z.literal(false)
}).strict().superRefine((record, context) => {
  const hasSnapshotLineage = record.sourceId !== null && record.sourceSnapshotId !== null && record.retrievalDisposition !== null;
  if ((record.sourceId === null) !== (record.sourceSnapshotId === null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceSnapshotId"], message: "Retrieval source and snapshot lineage must be paired." });
  if ((record.sourceId === null || record.sourceSnapshotId === null) !== (record.retrievalDisposition === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["retrievalDisposition"], message: "Retrieval disposition must appear exactly with complete source and snapshot lineage." });
  }
  if (record.state === "RETRIEVED_UNQUALIFIED" && (!hasSnapshotLineage || record.rejectionCode !== null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["state"], message: "Retrieved observations require complete snapshot lineage and no rejection." });
  if (record.state === "RETRIEVAL_REJECTED" && record.rejectionCode === null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionCode"], message: "Rejected retrieval requires a bounded rejection code." });
});

export type SourceSubmissionRetrieval = z.infer<typeof sourceSubmissionRetrievalSchema>;
