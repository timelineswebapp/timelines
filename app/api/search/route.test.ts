import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/search/route";

test("public search rejects duplicate scalar query parameters before content reads", async () => {
  const response = await GET(new Request("https://timelines.example/api/search?q=rome&q=empire"));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_FAILED");
});
