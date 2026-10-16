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
};

export const factoryV2AdminService = {
  listDeferredTopics: (limit = 25) => serverlessBackendClient.listDeferredFactoryV2Topics<DeferredFactoryV2Topic>(limit)
};
