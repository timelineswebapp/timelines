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

/**
 * Normalizes an authenticated operational list limit while rejecting HTTP
 * parameter pollution. Invalid single values retain the established safe
 * default; valid values are clamped to the server-owned range.
 */
export function parseBoundedAdminListLimit(
  searchParams: URLSearchParams,
  fallback = 25,
  minimum = 1,
  maximum = 100
) {
  const values = searchParams.getAll("limit");
  if (values.length > 1) {
    throw new ApiError(400, "VALIDATION_FAILED", "Query parameter limit must appear at most once.");
  }

  const value = values[0];
  if (!value) return fallback;
  if (!/^\d+$/u.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

/**
 * Reads an optional, single-valued enum filter for authenticated operational
 * lists.  HTTP parameter pollution and unknown values are rejected before a
 * filter can reach a service or repository boundary.
 */
export function parseOptionalEnumQueryParameter<T extends readonly string[]>(
  searchParams: URLSearchParams,
  name: string,
  values: T
): T[number] | undefined {
  const matches = searchParams.getAll(name);
  if (matches.length === 0) return undefined;
  if (matches.length !== 1) {
    throw new ApiError(400, "VALIDATION_FAILED", `Query parameter ${name} must appear at most once.`);
  }

  if (matches[0] === "") return undefined;

  const value = matches[0]!;
  if (!values.includes(value)) {
    throw new ApiError(400, "VALIDATION_FAILED", `Invalid query parameter ${name}.`);
  }
  return value as T[number];
}

/** Reads an optional unstructured control while still rejecting duplicate keys. */
export function parseOptionalSingleQueryParameter(searchParams: URLSearchParams, name: string): string | undefined {
  const matches = searchParams.getAll(name);
  if (matches.length === 0) return undefined;
  if (matches.length !== 1) {
    throw new ApiError(400, "VALIDATION_FAILED", `Query parameter ${name} must appear at most once.`);
  }
  if (matches[0] === "") return undefined;
  return matches[0];
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
export function isCanonicalPublicSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+){0,31}$/u.test(value) && value.length <= 160;
}

/** Validates canonical public route slugs before repository access. */
export function parseCanonicalPublicSlug(value: string) {
  if (!isCanonicalPublicSlug(value)) {
    throw new ApiError(400, "VALIDATION_FAILED", "Invalid public slug.");
  }
  return value;
}
