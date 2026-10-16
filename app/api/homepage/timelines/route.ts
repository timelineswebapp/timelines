import { type NextRequest } from "next/server";
import { ApiError, ok, fromError } from "@/src/server/api/responses";
import { parseBoundedIntegerQueryParameter, parseOptionalIsoDateQueryParameter } from "@/src/server/api/query-params";
import { contentService } from "@/src/server/services/content-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    for (const key of ["offset", "limit", "snapshotDate"]) {
      if (searchParams.getAll(key).length > 1) throw new ApiError(400, "VALIDATION_FAILED", `Query parameter ${key} must appear at most once.`);
    }
    const offset = parseBoundedIntegerQueryParameter(searchParams.get("offset"), 0, 0, 10_000);
    const limit = parseBoundedIntegerQueryParameter(searchParams.get("limit"), 12, 1, 24);
    const snapshotDate = parseOptionalIsoDateQueryParameter(searchParams.get("snapshotDate"));
    const data = await contentService.getHomepageSnapshotSlice(offset, limit, snapshotDate);

    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}
