import { ApiError } from "@/src/server/api/responses";

/** Parses a canonical bounded nonnegative integer query parameter. */
export function parseBoundedIntegerQueryParameter(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!value) return fallback;
  if (!/^\d+$/u.test(value)) throw new ApiError(400, "VALIDATION_FAILED", "Invalid pagination parameters.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiError(400, "VALIDATION_FAILED", "Invalid pagination parameters.");
  }
  return parsed;
}

/** Parses an optional canonical ISO calendar date without accepting reflected arbitrary text. */
export function parseOptionalIsoDateQueryParameter(value: string | null) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new ApiError(400, "VALIDATION_FAILED", "Invalid snapshot date.");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "VALIDATION_FAILED", "Invalid snapshot date.");
  }
  return value;
}

/** Validates canonical public route slugs before repository access. */
export function parseCanonicalPublicSlug(value: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+){0,31}$/u.test(value) || value.length > 160) {
    throw new ApiError(400, "VALIDATION_FAILED", "Invalid public slug.");
  }
  return value;
}
