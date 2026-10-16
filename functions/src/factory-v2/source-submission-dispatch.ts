import { z } from "zod";
import { idSchema } from "./contracts/common";
import { retrieveSubmittedSourceCandidate } from "./source-submission-retrieval";
import type { V2FirestoreRepository } from "./repositories/firestore";

/** Internal-only, bounded dispatch contract; intentionally not an HTTP payload. */
export const sourceSubmissionDispatchSchema = z.object({
  candidateId: idSchema,
  dispatchId: idSchema
}).strict();

export async function dispatchSourceSubmissionRetrieval(input: unknown, repository: V2FirestoreRepository) {
  const task = sourceSubmissionDispatchSchema.parse(input);
  return retrieveSubmittedSourceCandidate({ repository, candidateId: task.candidateId });
}
