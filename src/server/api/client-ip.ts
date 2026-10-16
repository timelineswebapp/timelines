import { isIP } from "node:net";
import { config } from "@/src/lib/config";

function canonicalIp(value: string | null): string | null {
  const candidate = value?.split(",", 1)[0]?.trim() || "";
  return isIP(candidate) === 0 ? null : candidate;
}

/**
 * Resolves the rate-limit identity without trusting client-supplied forwarding
 * headers in production. Vercel owns x-vercel-forwarded-for at the edge; when
 * it is absent or malformed the fail-closed shared identity preserves a bound
 * rather than letting callers choose arbitrary rate-limit keys.
 */
export function trustedClientIp(request: Request): string {
  if (config.isProduction) {
    return canonicalIp(request.headers.get("x-vercel-forwarded-for")) || "unknown";
  }

  return canonicalIp(request.headers.get("x-forwarded-for"))
    || canonicalIp(request.headers.get("x-real-ip"))
    || "127.0.0.1";
}
