import { randomBytes } from "node:crypto";
import { fail, fromError } from "@/src/server/api/responses";
import { trustedClientIp } from "@/src/server/api/client-ip";
import { config } from "@/src/lib/config";
import {
  auditAdminSecurityEvent,
  csrfTokenValid,
  identityHasAnyRole,
  resolveAdminIdentity,
  type AdminOperatorRole
} from "@/src/server/security/admin-identity";
import type { AdminOperatorIdentity } from "@/src/server/security/admin-identity";

const ADMIN_RATE_LIMIT_WINDOW_MS = 60_000;
const ADMIN_RATE_LIMIT_MAX_REQUESTS = 60;
const ADMIN_RATE_LIMIT_MAX_KEYS = 4_096;
const ADMIN_CSRF_MAX_AGE_SECONDS = 8 * 60 * 60;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastRateLimitPruneAt = 0;

function pruneExpiredRateLimits(now: number, force = false): void {
  if (!force && now - lastRateLimitPruneAt < 1_000) return;
  for (const [candidateKey, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) rateLimitStore.delete(candidateKey);
  }
  lastRateLimitPruneAt = now;
}

export function resetAdminRateLimitStoreForTests(): void {
  rateLimitStore.clear();
  lastRateLimitPruneAt = 0;
}

export function checkAdminRateLimit(request: Request): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const key = trustedClientIp(request);
  pruneExpiredRateLimits(now);

  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    if (rateLimitStore.size >= ADMIN_RATE_LIMIT_MAX_KEYS) {
      pruneExpiredRateLimits(now, true);
      if (rateLimitStore.size >= ADMIN_RATE_LIMIT_MAX_KEYS) return { allowed: false, retryAfter: 1 };
    }
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

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get("cookie") || "";
  let matchedValue: string | null = null;
  for (const segment of cookie.split(";")) {
    const [key, ...valueParts] = segment.trim().split("=");
    if (key === name) {
      if (matchedValue !== null) return "";
      try {
        matchedValue = decodeURIComponent(valueParts.join("="));
      } catch {
        return "";
      }
    }
  }
  return matchedValue || "";
}

function csrfCookieValue(request: Request): string {
  return cookieValue(request, config.adminCsrfCookieName) || randomBytes(32).toString("base64url");
}

function attachAdminCsrfCookie(response: Response, request: Request): Response {
  const attributes = [
    `${config.adminCsrfCookieName}=${encodeURIComponent(csrfCookieValue(request))}`,
    "Path=/",
    `Max-Age=${ADMIN_CSRF_MAX_AGE_SECONDS}`,
    "SameSite=Strict"
  ];
  if (config.isProduction) {
    attributes.push("Secure");
  }
  response.headers.append("set-cookie", attributes.join("; "));
  return response;
}

export async function isAdminAuthorized(request: Request): Promise<boolean> {
  return Boolean(await resolveAdminIdentity(request));
}

type AdminHandler<TContext = unknown> = (request: Request, context: TContext, identity: AdminOperatorIdentity) => Promise<Response>;

type AdminAuthOptions = {
  roles?: AdminOperatorRole[];
};

export function withAdminAuth<TContext = unknown>(handler: AdminHandler<TContext>, options: AdminAuthOptions = {}) {
  return async (request: Request, context: TContext): Promise<Response> => {
    const rateLimit = checkAdminRateLimit(request);
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

    const identity = await resolveAdminIdentity(request);
    if (!identity) {
      auditAdminSecurityEvent("admin_auth_failed", request, null);
      return fail(401, "Unauthorized.", undefined, "UNAUTHORIZED");
    }

    // Privileged browser and Admin API access requires server-attested MFA in
    // production. Cron and internal machine-to-machine paths use separate
    // authenticated boundaries rather than this Admin wrapper.
    if (config.isProduction && !identity.mfaVerified) {
      auditAdminSecurityEvent("admin_mfa_rejected", request, identity);
      return fail(403, "Multi-factor authentication is required.", undefined, "MFA_REQUIRED");
    }

    if (options.roles && !identityHasAnyRole(identity, options.roles)) {
      auditAdminSecurityEvent("admin_rbac_rejected", request, identity, { requiredRoles: options.roles });
      return fail(403, "Forbidden.", undefined, "FORBIDDEN");
    }

    if (!csrfTokenValid(request)) {
      auditAdminSecurityEvent("admin_csrf_rejected", request, identity);
      return fail(403, "CSRF validation failed.", undefined, "CSRF_REJECTED");
    }

    auditAdminSecurityEvent("admin_auth_succeeded", request, identity);

    try {
      return attachAdminCsrfCookie(await handler(request, context, identity), request);
    } catch (error) {
      auditAdminSecurityEvent("admin_request_failed", request, identity, {
        error: error instanceof Error ? error.message : String(error)
      });
      return fromError(error);
    }
  };
}
