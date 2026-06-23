import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/src/lib/config";
import {
  adminSessionRevocationRepository,
  type AdminSessionRevocation
} from "@/src/server/repositories/admin-session-revocation-repository";
import {
  adminSecurityAuditRepository,
  type AdminSecurityAuditRecord
} from "@/src/server/repositories/admin-security-audit-repository";

export type AdminOperatorRole =
  | "super_admin"
  | "admin"
  | "factory_operator"
  | "governance_operator"
  | "library_operator"
  | "auditor"
  | "automation";

export type AdminAuthMethod = "legacy_token" | "operator_token" | "session";

export type AdminOperatorIdentity = {
  operatorId: string;
  displayName: string;
  roles: AdminOperatorRole[];
  authMethod: AdminAuthMethod;
  mfaVerified: boolean;
  sessionId: string | null;
};

export type AdminOperatorToken = {
  operatorId: string;
  displayName: string;
  roles: AdminOperatorRole[];
  token: string;
  mfaVerified: boolean;
};

export type AdminSecurityEvent =
  | "admin_auth_failed"
  | "admin_auth_succeeded"
  | "admin_csrf_rejected"
  | "admin_rbac_rejected"
  | "admin_request_failed"
  | "admin_security_violation"
  | "admin_session_revoked";

const VALID_ADMIN_ROLES = new Set<AdminOperatorRole>([
  "super_admin",
  "admin",
  "factory_operator",
  "governance_operator",
  "library_operator",
  "auditor",
  "automation"
]);

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ADMIN_SESSION_COOKIE_NAME = "timelines_admin_session";
const revokedSessions = new Set<string>();
let sessionRevocationStore: {
  revoke(input: { sessionId: string; operatorId?: string | null; reason?: string | null }): Promise<AdminSessionRevocation>;
  isRevoked(sessionId: string): Promise<boolean>;
} | null = adminSessionRevocationRepository;
let securityAuditStore: {
  append(record: AdminSecurityAuditRecord): Promise<void>;
} | null = adminSecurityAuditRepository;

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function extractBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }
  return request.headers.get("x-admin-token")?.trim() || "";
}

function parseRoleList(value: string): AdminOperatorRole[] {
  const roles = value
    .split(",")
    .map((role) => role.trim())
    .filter((role): role is AdminOperatorRole => VALID_ADMIN_ROLES.has(role as AdminOperatorRole));

  return roles.length > 0 ? Array.from(new Set(roles)) : ["admin"];
}

export function parseAdminOperatorTokens(value = config.adminOperatorTokens): AdminOperatorToken[] {
  if (!value.trim()) return [];

  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [operatorId, roles, token, displayName = operatorId, mfa = "false"] = entry.split("|").map((part) => part.trim());
      if (!operatorId || !token) return null;
      return {
        operatorId,
        displayName: displayName || operatorId,
        roles: parseRoleList(roles || "admin"),
        token,
        mfaVerified: mfa === "true" || mfa === "mfa"
      };
    })
    .filter((operator): operator is AdminOperatorToken => Boolean(operator));
}

export async function resolveAdminIdentity(request: Request): Promise<AdminOperatorIdentity | null> {
  const sessionIdentity = await parseSignedSession(request);
  if (sessionIdentity) return sessionIdentity;

  const token = extractBearerToken(request);
  if (!token) return null;

  for (const operator of parseAdminOperatorTokens()) {
    if (safeEqual(token, operator.token)) {
      return {
        operatorId: operator.operatorId,
        displayName: operator.displayName,
        roles: operator.roles,
        authMethod: "operator_token",
        mfaVerified: operator.mfaVerified,
        sessionId: null
      };
    }
  }

  if (config.adminApiToken && safeEqual(token, config.adminApiToken)) {
    return {
      operatorId: "legacy-admin-token",
      displayName: "Legacy Admin Token",
      roles: ["super_admin", "admin", "automation"],
      authMethod: "legacy_token",
      mfaVerified: false,
      sessionId: null
    };
  }

  return null;
}

export function identityHasAnyRole(identity: AdminOperatorIdentity, allowedRoles: AdminOperatorRole[]): boolean {
  if (identity.roles.includes("super_admin")) return true;
  return allowedRoles.some((role) => identity.roles.includes(role));
}

export function browserCsrfProtectionApplies(request: Request): boolean {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return false;
  if (request.headers.get("cookie")) return true;
  const secFetchSite = request.headers.get("sec-fetch-site");
  return Boolean(secFetchSite && secFetchSite !== "none");
}

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get("cookie") || "";
  for (const segment of cookie.split(";")) {
    const [key, ...valueParts] = segment.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return "";
}

function signSessionPayload(payload: string): string {
  return createHmac("sha256", config.adminSessionSecret).update(payload).digest("base64url");
}

async function sessionIsRevoked(sessionId: string): Promise<boolean> {
  if (revokedSessions.has(sessionId)) return true;
  if (!sessionRevocationStore) return false;
  try {
    return await sessionRevocationStore.isRevoked(sessionId);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        component: "admin_security",
        event: "admin_session_revocation_check_failed",
        error: error instanceof Error ? error.message : String(error)
      })
    );
    return true;
  }
}

async function parseSignedSession(request: Request): Promise<AdminOperatorIdentity | null> {
  if (!config.adminSessionSecret) return null;

  const cookie = cookieValue(request, ADMIN_SESSION_COOKIE_NAME);
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature || !safeEqual(signSessionPayload(payload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      operatorId?: unknown;
      displayName?: unknown;
      roles?: unknown;
      exp?: unknown;
      sessionId?: unknown;
      mfaVerified?: unknown;
    };
    if (typeof parsed.operatorId !== "string" || typeof parsed.exp !== "number" || parsed.exp <= Date.now()) {
      return null;
    }
    const roles = Array.isArray(parsed.roles)
      ? parsed.roles.filter((role): role is AdminOperatorRole => VALID_ADMIN_ROLES.has(role as AdminOperatorRole))
      : [];
    if (roles.length === 0) return null;
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : null;
    if (sessionId && await sessionIsRevoked(sessionId)) return null;

    return {
      operatorId: parsed.operatorId,
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : parsed.operatorId,
      roles,
      authMethod: "session",
      mfaVerified: parsed.mfaVerified === true,
      sessionId
    };
  } catch {
    return null;
  }
}

export function csrfTokenValid(request: Request): boolean {
  if (!browserCsrfProtectionApplies(request)) return true;

  const headerToken = request.headers.get("x-csrf-token")?.trim() || "";
  const cookieToken = cookieValue(request, config.adminCsrfCookieName);
  if (!headerToken || !cookieToken) return false;
  return safeEqual(headerToken, cookieToken);
}

export function auditAdminSecurityEvent(
  event: AdminSecurityEvent,
  request: Request,
  identity: AdminOperatorIdentity | null,
  details: Record<string, unknown> = {}
): void {
  const pathname = new URL(request.url).pathname;
  const auditRecord: AdminSecurityAuditRecord = {
    eventType: event,
    operatorId: identity?.operatorId ?? null,
    authMethod: identity?.authMethod ?? null,
    roles: identity?.roles ?? [],
    mfaVerified: identity?.mfaVerified ?? false,
    method: request.method,
    pathname,
    details
  };
  console.info(
    JSON.stringify({
      level: event.endsWith("failed") || event.endsWith("rejected") ? "warn" : "info",
      component: "admin_security",
      event,
      method: request.method,
      pathname,
      operatorId: identity?.operatorId ?? null,
      roles: identity?.roles ?? [],
      authMethod: identity?.authMethod ?? null,
      mfaVerified: identity?.mfaVerified ?? false,
      ...details
    })
  );
  if (securityAuditStore) {
    void securityAuditStore.append(auditRecord).catch((error) => {
      console.error(
        JSON.stringify({
          level: "error",
          component: "admin_security",
          event: "admin_security_audit_persistence_failed",
          error: error instanceof Error ? error.message : String(error)
        })
      );
    });
  }
}

export async function revokeAdminSession(input: { sessionId: string; operatorId?: string | null; reason?: string | null }): Promise<void> {
  revokedSessions.add(input.sessionId);
  if (sessionRevocationStore) {
    await sessionRevocationStore.revoke(input);
  }
  if (securityAuditStore) {
    try {
      await securityAuditStore.append({
        eventType: "admin_session_revoked",
        operatorId: input.operatorId ?? null,
        authMethod: null,
        roles: [],
        mfaVerified: false,
        method: "SESSION",
        pathname: "/admin/session/revocations",
        details: {
          sessionId: input.sessionId,
          reason: input.reason ?? null
        }
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          component: "admin_security",
          event: "admin_session_revocation_audit_persistence_failed",
          error: error instanceof Error ? error.message : String(error)
        })
      );
    }
  }
  console.info(
    JSON.stringify({
      level: "info",
      component: "admin_security",
      event: "admin_session_revoked",
      sessionId: input.sessionId,
      operatorId: input.operatorId ?? null,
      reason: input.reason ?? null
    })
  );
}

export function resetAdminSecurityStateForTests(): void {
  revokedSessions.clear();
}

export function setAdminSessionRevocationStoreForTests(
  store: {
    revoke(input: { sessionId: string; operatorId?: string | null; reason?: string | null }): Promise<AdminSessionRevocation>;
    isRevoked(sessionId: string): Promise<boolean>;
  } | null
): void {
  sessionRevocationStore = store;
}

export function setAdminSecurityAuditStoreForTests(
  store: {
    append(record: AdminSecurityAuditRecord): Promise<void>;
  } | null
): void {
  securityAuditStore = store;
}
