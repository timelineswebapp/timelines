import { config } from "@/src/lib/config";
import { fail, fromError } from "@/src/server/api/responses";

const ADMIN_RATE_LIMIT_WINDOW_MS = 60_000;
const ADMIN_RATE_LIMIT_MAX_REQUESTS = 60;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function checkRateLimit(request: Request): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const key = getClientIp(request);

  for (const [candidateKey, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(candidateKey);
    }
  }

  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + ADMIN_RATE_LIMIT_WINDOW_MS
    });
    return { allowed: true };
  }

  if (current.count >= ADMIN_RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  return { allowed: true };
}

export function isAdminAuthorized(request: Request): boolean {
  if (!config.adminApiToken) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const headerToken = request.headers.get("x-admin-token");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : headerToken;

  return token === config.adminApiToken;
}

type AdminHandler<TContext = unknown> = (request: Request, context: TContext) => Promise<Response>;

export function withAdminAuth<TContext = unknown>(handler: AdminHandler<TContext>) {
  return async (request: Request, context: TContext): Promise<Response> => {
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      return fail(
        429,
        "Too many admin requests.",
        { retryAfterSeconds: rateLimit.retryAfter },
        "RATE_LIMITED",
        {
          headers: {
            "retry-after": String(rateLimit.retryAfter)
          }
        }
      );
    }

    if (!isAdminAuthorized(request)) {
      return fail(401, "Unauthorized.", undefined, "UNAUTHORIZED");
    }

    try {
      return await handler(request, context);
    } catch (error) {
      return fromError(error);
    }
  };
}
