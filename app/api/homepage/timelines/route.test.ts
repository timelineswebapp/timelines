import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/homepage/timelines/route";

test("homepage pagination rejects malformed, excessive, and zero-limit input before content reads", async () => {
  for (const query of ["offset=2junk", "offset=10001", "limit=0", "limit=25", "limit=1.5"]) {
    const response = await GET(new NextRequest(`https://timelines.example/api/homepage/timelines?${query}`));
    assert.equal(response.status, 400, query);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Invalid pagination parameters." }
    });
  }
});
