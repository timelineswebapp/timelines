import type { TimelineRequestSubmission, TimelineRequestType } from "@/src/lib/types";
import { serverlessBackendClient } from "@/src/server/serverless/backend-client";

export type PublicRequestInput = {
  query: string;
  language: string;
  ip: string;
  requestType?: TimelineRequestType;
  email?: string | null;
  message?: string | null;
  targetTimeline?: string | null;
  sourcesScope?: string | null;
  metadata?: Record<string, unknown>;
};

export const requestService = {
  async createTimelineRequest(input: PublicRequestInput): Promise<TimelineRequestSubmission> {
    const result = await serverlessBackendClient.submitTopic<TimelineRequestSubmission>({
      query: input.query,
      language: input.language,
      requestType: input.requestType,
      email: input.email,
      message: input.message,
      targetTimeline: input.targetTimeline,
      sourcesScope: input.sourcesScope,
      metadata: input.metadata
    }, input.ip);
    if (!result) throw new Error("Serverless topic intake is unavailable in this environment.");
    return result;
  }
};
