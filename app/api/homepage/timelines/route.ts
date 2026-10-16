import { type NextRequest } from "next/server";
import { ok, fromError, ApiError } from "@/src/server/api/responses";
import { contentService } from "@/src/server/services/content-service";

export const dynamic = "force-dynamic";

function parseBoundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (!value) {
    return fallback;
  }

  if (!/^\d+$/u.test(value)) {
    throw new ApiError(400, "VALIDATION_FAILED", "Invalid pagination parameters.");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiError(400, "VALIDATION_FAILED", "Invalid pagination parameters.");
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = parseBoundedInteger(searchParams.get("offset"), 0, 0, 10_000);
    const limit = parseBoundedInteger(searchParams.get("limit"), 12, 1, 24);
    const snapshotDate = searchParams.get("snapshotDate") || undefined;
    const data = await contentService.getHomepageSnapshotSlice(offset, limit, snapshotDate);

    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}
