import { type NextRequest } from "next/server";
import { ok, fromError, ApiError } from "@/src/server/api/responses";
import { contentService } from "@/src/server/services/content-service";

export const dynamic = "force-dynamic";

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError(400, "VALIDATION_FAILED", "Invalid pagination parameters.");
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = parsePositiveInteger(searchParams.get("offset"), 0);
    const limit = parsePositiveInteger(searchParams.get("limit"), 12);
    const snapshotDate = searchParams.get("snapshotDate") || undefined;
    const data = await contentService.getHomepageSnapshotSlice(offset, limit, snapshotDate);

    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}
