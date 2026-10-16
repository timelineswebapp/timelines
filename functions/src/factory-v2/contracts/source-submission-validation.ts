import { z } from "zod";
import { executionEnvelopeFields, idSchema } from "./common";

/** Immutable authority-only outcome; it is never evidence admission. */
export const sourceSubmissionValidationSchema = z.object({
  ...executionEnvelopeFields,
  sourceSubmissionValidationId: idSchema,
  sourceSubmissionCandidateId: idSchema,
  originalOperationId: idSchema,
  originalFailureRecordId: idSchema,
  topicAuthoritySetId: idSchema,
  publisherVersionId: idSchema,
  state: z.literal("AUTHORITY_ELIGIBLE"),
  sourceSnapshotId: z.null(),
  qualifyingEvidence: z.literal(false)
}).strict();
