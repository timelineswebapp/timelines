import { requestRepository } from "@/src/server/repositories/request-repository";

const MAX_REQUESTS_PER_DAY = 3;

export const requestService = {
  async createTimelineRequest(input: { query: string; language: string; ip: string }) {
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
