import { fail, fromError, ok } from "@/src/server/api/responses";
import { trustedClientIp } from "@/src/server/api/client-ip";
import { requestService } from "@/src/server/services/request-service";
import { timelineRequestSchema } from "@/src/server/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = timelineRequestSchema.parse(body);
    const created = await requestService.createTimelineRequest({
      ...input,
      ip: trustedClientIp(request)
    });
    return ok(created, { status: created.status === "QUEUED" ? 202 : 200 });
  } catch (error) {
    if (error instanceof Error && error.name === "RateLimitExceeded") {
      return fail(429, "Daily request limit exceeded for this IP.");
    }

    return fromError(error);
  }
}
