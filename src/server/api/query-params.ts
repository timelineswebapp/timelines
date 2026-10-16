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
