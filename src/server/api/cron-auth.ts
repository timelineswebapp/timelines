import { timingSafeEqual } from "node:crypto";

type CronAuthenticationFailure =
  | "missing_environment_secret"
  | "missing_authorization_header"
  | "bearer_parsing_failed"
  | "different_lengths"
  | "timing_safe_equal_false";

export interface CronAuthenticationDiagnostics {
  environmentSecretExists: boolean;
  environmentSecretLength: number;
  authorizationHeaderExists: boolean;
  suppliedBearerTokenLength: number;
  bearerParsingSucceeded: boolean;
  failure: CronAuthenticationFailure;
}

export type CronAuthenticationResult =
  | { authorized: true }
  | { authorized: false; diagnostics: CronAuthenticationDiagnostics };

export function authenticateCronRequest(request: Request): CronAuthenticationResult {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  const supplied = bearerMatch?.[1] || "";

  const diagnostics = (
    failure: CronAuthenticationFailure
  ): { authorized: false; diagnostics: CronAuthenticationDiagnostics } => ({
    authorized: false,
    diagnostics: {
      environmentSecretExists: Boolean(expected),
      environmentSecretLength: expected?.length || 0,
      authorizationHeaderExists: authorization !== null,
      suppliedBearerTokenLength: supplied.length,
      bearerParsingSucceeded: Boolean(bearerMatch),
      failure
    }
  });

  if (!expected) return diagnostics("missing_environment_secret");
  if (!authorization) return diagnostics("missing_authorization_header");
  if (!bearerMatch) return diagnostics("bearer_parsing_failed");
  if (expected.length !== supplied.length) return diagnostics("different_lengths");
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return diagnostics("timing_safe_equal_false");
  }

  return { authorized: true };
}
