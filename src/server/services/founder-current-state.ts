import { factoryV2AdminService } from "@/src/server/services/factory-v2-admin-service";
import { serverlessBackendClient } from "@/src/server/serverless/backend-client";

export type FounderCurrentState = {
  availability: "available" | "unavailable";
  publicCorpus: "available" | "empty" | "unavailable";
  operationalTelemetry: "available" | "unavailable";
  deferredTopics: number | null;
  scheduledRetries: number | null;
  dueRetries: number | null;
  terminalDeliveryFailures: number | null;
  assessedAt: string;
};

type CurrentStateInput = Omit<FounderCurrentState, "assessedAt">;

export function currentInstitutionStatus(input: CurrentStateInput): "Healthy" | "Warning" | "Critical" {
  if (input.availability === "unavailable" || input.publicCorpus === "unavailable") return "Critical";
  if (input.operationalTelemetry === "unavailable" || (input.terminalDeliveryFailures ?? 0) > 0 || input.publicCorpus === "empty") return "Warning";
  return "Healthy";
}

/**
 * Reads bounded V2 and public-corpus facts only. Legacy PostgreSQL Factory
 * records are intentionally absent: they are historical evidence, not a
 * source of truth for the active public corpus.
 */
export async function getFounderCurrentState(): Promise<FounderCurrentState> {
  const assessedAt = new Date().toISOString();
  const [timelines, deferredTopics, retryHealth, enqueueFailures] = await Promise.allSettled([
    serverlessBackendClient.listReadModels<unknown>("timeline", 1, 0),
    factoryV2AdminService.listDeferredTopics(1),
    factoryV2AdminService.getGenerationRetryQueueHealth(),
    factoryV2AdminService.listGenerationEnqueueFailures(100)
  ]);
  if (timelines.status === "fulfilled") {
    return {
      availability: "available",
      publicCorpus: Array.isArray(timelines.value) && timelines.value.length > 0 ? "available" : "empty",
      operationalTelemetry: deferredTopics.status === "fulfilled" && retryHealth.status === "fulfilled" && enqueueFailures.status === "fulfilled" ? "available" : "unavailable",
      deferredTopics: deferredTopics.status === "fulfilled" ? deferredTopics.value.length : null,
      scheduledRetries: retryHealth.status === "fulfilled" ? retryHealth.value.scheduledCount : null,
      dueRetries: retryHealth.status === "fulfilled" ? retryHealth.value.dueCount : null,
      terminalDeliveryFailures: enqueueFailures.status === "fulfilled" ? enqueueFailures.value.length : null,
      assessedAt
    };
  }
  return {
    availability: "unavailable",
    publicCorpus: "unavailable",
    operationalTelemetry: "unavailable",
    deferredTopics: null,
    scheduledRetries: null,
    dueRetries: null,
    terminalDeliveryFailures: null,
    assessedAt
  };
}
