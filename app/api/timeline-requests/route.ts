import { fail, fromError, ok } from "@/src/server/api/responses";
import { requestService } from "@/src/server/services/request-service";
import { timelineRequestSchema } from "@/src/server/validation/schemas";

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = timelineRequestSchema.parse(body);
    const created = await requestService.createTimelineRequest({
      ...input,
      ip: getClientIp(request)
    });
    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "RateLimitExceeded") {
      return fail(429, "Daily request limit exceeded for this IP.");
    }

    return fromError(error);
  }
}
