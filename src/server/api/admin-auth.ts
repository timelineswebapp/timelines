import { config } from "@/src/lib/config";

export function isAdminAuthorized(request: Request): boolean {
  if (!config.adminApiToken) {
    return !config.isProduction;
  }

  const authHeader = request.headers.get("authorization");
  const headerToken = request.headers.get("x-admin-token");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : headerToken;

  return token === config.adminApiToken;
}
