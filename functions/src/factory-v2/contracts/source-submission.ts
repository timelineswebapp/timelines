import { z } from "zod";
import { boundedText, executionEnvelopeFields, httpsUrlSchema, idSchema } from "./common";

/** Admin-provided material is a provenance-bearing candidate only. */
export const sourceSubmissionCandidateSchema = z.object({
  ...executionEnvelopeFields,
  sourceSubmissionCandidateId: idSchema,
  originalOperationId: idSchema,
  originalFailureRecordId: idSchema,
  submittedUrl: httpsUrlSchema,
  rationale: boundedText(10, 1_000),
  submittedBy: boundedText(2, 240),
  state: z.literal("CANDIDATE"),
  sourceSnapshotId: z.null()
}).strict();

export type SourceSubmissionCandidate = z.infer<typeof sourceSubmissionCandidateSchema>;
