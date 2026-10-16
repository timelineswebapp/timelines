import assert from "node:assert/strict";
import test from "node:test";
import { GET as getTimeline } from "@/app/api/timelines/[slug]/route";
import { GET as getTag } from "@/app/api/tags/[slug]/route";

test("public detail routes reject malformed slugs before content reads", async () => {
  for (const get of [getTimeline, getTag]) {
    for (const slug of ["Bad-Slug", "two--hyphens", "space value", "x".repeat(161)]) {
      const response = await get(new Request("https://timelines.example"), { params: Promise.resolve({ slug }) });
      assert.equal(response.status, 400, slug);
      assert.deepEqual(await response.json(), {
        ok: false,
        error: { code: "VALIDATION_FAILED", message: "Invalid public slug." }
      });
    }
  }
});
