import { factoryV2AdminService } from "@/src/server/services/factory-v2-admin-service";
import { serverlessBackendClient } from "@/src/server/serverless/backend-client";

export type FounderCurrentState = {
  availability: "available" | "unavailable";
  publicCorpus: "available" | "empty" | "unavailable";
  deferredTopics: number;
  scheduledRetries: number;
  dueRetries: number;
  terminalDeliveryFailures: number;
  assessedAt: string;
};

type CurrentStateInput = Omit<FounderCurrentState, "assessedAt">;

export function currentInstitutionStatus(input: CurrentStateInput): "Healthy" | "Warning" | "Critical" {
  if (input.availability === "unavailable" || input.publicCorpus === "unavailable") return "Critical";
  if (input.terminalDeliveryFailures > 0 || input.publicCorpus === "empty") return "Warning";
  return "Healthy";
}

/**
 * Reads bounded V2 and public-corpus facts only. Legacy PostgreSQL Factory
 * records are intentionally absent: they are historical evidence, not a
 * source of truth for the active public corpus.
 */
export async function getFounderCurrentState(): Promise<FounderCurrentState> {
  const assessedAt = new Date().toISOString();
  try {
    const [deferredTopics, retryHealth, enqueueFailures, timelines] = await Promise.all([
      factoryV2AdminService.listDeferredTopics(1),
      factoryV2AdminService.getGenerationRetryQueueHealth(),
      factoryV2AdminService.listGenerationEnqueueFailures(100),
      serverlessBackendClient.listReadModels<unknown>("timeline", 1, 0)
    ]);
    return {
      availability: "available",
      publicCorpus: Array.isArray(timelines) && timelines.length > 0 ? "available" : "empty",
      deferredTopics: deferredTopics.length,
      scheduledRetries: retryHealth.scheduledCount,
      dueRetries: retryHealth.dueCount,
      terminalDeliveryFailures: enqueueFailures.length,
      assessedAt
    };
  } catch {
    return {
      availability: "unavailable",
      publicCorpus: "unavailable",
      deferredTopics: 0,
      scheduledRetries: 0,
      dueRetries: 0,
      terminalDeliveryFailures: 0,
      assessedAt
    };
  }
}
