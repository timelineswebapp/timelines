import { requestRepository } from "@/src/server/repositories/request-repository";
import type { TimelineRequestType } from "@/src/lib/types";

const MAX_REQUESTS_PER_DAY = 3;

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
  async createTimelineRequest(input: PublicRequestInput) {
    const ipHash = requestRepository.hashIp(input.ip);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);

    const totalToday = await requestRepository.countByIpSince(ipHash, since.toISOString());
    if (totalToday >= MAX_REQUESTS_PER_DAY) {
      const error = new Error("Rate limit exceeded.");
      error.name = "RateLimitExceeded";
      throw error;
    }

    return requestRepository.create(input);
  }
};
