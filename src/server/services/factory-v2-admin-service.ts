import { serverlessBackendClient } from "@/src/server/serverless/backend-client";

export type DeferredFactoryV2Topic = {
  topicId: string;
  runId: string;
  generation: number;
  stage: string;
  updatedAt: string;
  terminalFailureRecordId: string | null;
  outcome: {
    classification: "PUBLIC_EVIDENCE_LIMITATION" | "RESEARCH_BUDGET_EXHAUSTED";
    reentryState: "REQUIRES_RELEVANT_CHANGE" | "REQUIRES_AUTHORIZED_RETRY";
    detailedReason: string;
  };
  operationalFeasibility: {
    state: "REENTRY_CONDITION_REQUIRED";
    requiredCondition: "RELEVANT_EVIDENCE_CHANGE" | "AUTHORIZED_RETRY";
    terminalAt: string;
    attemptsConsumed: number;
    budgetConsumed: Record<string, number>;
    failureClass: string;
  };
};

export type DeferredFactoryV2ReentryResult = {
  state: "CREATED" | "IDEMPOTENT";
  requestId: string;
};
export type FactoryV2SourceSubmissionResult = { state: "CREATED" | "IDEMPOTENT"; candidateId: string };
export type FactoryV2SourceSubmission = { candidateId: string; operationId: string; submittedUrl: string; rationale: string; submittedBy: string; createdAt: string; state: "CANDIDATE" };
export type GenerationRetryQueueItem = { topicId: string; jobId: string; generation: number; origin: "user" | "autonomous"; state: "RETRY_SCHEDULED"; nextRetryAt: string; updatedAt: string; lastErrorPresent: boolean };

export const factoryV2AdminService = {
  listDeferredTopics: (limit = 25) => serverlessBackendClient.listDeferredFactoryV2Topics<DeferredFactoryV2Topic>(limit),
  listGenerationRetryQueue: (limit = 25) => serverlessBackendClient.listGenerationRetryQueue<GenerationRetryQueueItem>(limit),
  createDeferredReentry: (input: { operationId: string; trigger: "RELEVANT_EVIDENCE_CHANGE" | "AUTHORIZED_RETRY"; relevantChangeArtifactId: string | null; authorizedBy: string | null; authorizationReason: string | null }) => serverlessBackendClient.createDeferredFactoryV2Reentry<DeferredFactoryV2ReentryResult>(input),
  createSourceSubmission: (input: { operationId: string; submittedUrl: string; rationale: string; submittedBy: string }) => serverlessBackendClient.createFactoryV2SourceSubmission<FactoryV2SourceSubmissionResult>(input),
  listSourceSubmissions: (limit = 25) => serverlessBackendClient.listFactoryV2SourceSubmissions<FactoryV2SourceSubmission>(limit)
};
