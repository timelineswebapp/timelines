import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/homepage/timelines/route";

test("homepage pagination and snapshot date reject invalid input before content reads", async () => {
  for (const query of ["offset=2junk", "offset=10001", "limit=0", "limit=25", "limit=1.5", "snapshotDate=2026-02-30", "snapshotDate=2026-2-03", "snapshotDate=unbounded-value"]) {
    const response = await GET(new NextRequest(`https://timelines.example/api/homepage/timelines?${query}`));
    assert.equal(response.status, 400, query);
    const payload = await response.json() as { ok: boolean; error: { code: string } };
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, "VALIDATION_FAILED");
  }
});

test("homepage pagination rejects duplicate scalar controls before content reads", async () => {
  const response = await GET(new NextRequest("https://timelines.example/api/homepage/timelines?limit=12&limit=24"));
  assert.equal(response.status, 400);
  assert.equal((await response.json() as { error: { code: string } }).error.code, "VALIDATION_FAILED");
});
