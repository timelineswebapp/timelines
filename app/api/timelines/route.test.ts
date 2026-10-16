import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/timelines/route";

test("timeline catalog rejects noncanonical and out-of-range limits before content reads", async () => {
  for (const limit of ["2junk", "1.5", "0", "51", "999999999999999999999999"]) {
    const response = await GET(new Request(`https://timelines.example/api/timelines?limit=${limit}`));
    assert.equal(response.status, 400, limit);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Invalid pagination parameters." }
    });
  }
});
