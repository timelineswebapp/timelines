export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { fromError, ok } from "@/src/server/api/responses";
import { telemetryService } from "@/src/server/services/telemetry-service";
import { timelineViewTelemetrySchema } from "@/src/server/validation/schemas";

const SESSION_COOKIE_NAME = "timeline_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function inferDevice(userAgent: string | null) {
  if (!userAgent) {
    return null;
  }

  const normalizedUserAgent = userAgent.toLowerCase();
  if (normalizedUserAgent.includes("ipad") || normalizedUserAgent.includes("tablet")) {
    return "tablet";
  }

  if (
    normalizedUserAgent.includes("mobile")
    || normalizedUserAgent.includes("iphone")
    || normalizedUserAgent.includes("android")
  ) {
    return "mobile";
  }

  return "desktop";
}

export async function POST(request: Request) {
  try {
    const payload = timelineViewTelemetrySchema.parse(await request.json());
    const cookieStore = await cookies();
    let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
    const shouldSetSessionCookie = !sessionId;

    if (!sessionId) {
      sessionId = crypto.randomUUID();
    }

    const insertedId = await telemetryService.recordTimelineView({
      timelineId: payload.timelineId,
      slug: payload.slug,
      sessionId,
      country: request.headers.get("x-vercel-ip-country"),
      device: inferDevice(request.headers.get("user-agent")),
      referrer: request.headers.get("referer"),
      metadata: {}
    });

    const response = ok(
      {
        accepted: true,
        eventId: insertedId
      },
      { status: 202 }
    );

    if (shouldSetSessionCookie && sessionId) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: sessionId,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_COOKIE_MAX_AGE
      });
    }

    return response;
  } catch (error) {
    return fromError(error);
  }
}
