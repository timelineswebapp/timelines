import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("homepage Open Graph metadata uses the server-controlled canonical URL resolver", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  assert.match(source, /import \{ buildPublicUrl \} from "@\/src\/lib\/public-site";/u);
  assert.match(source, /url: buildPublicUrl\("\/"\)/u);
  assert.doesNotMatch(source, /https:\/\/www\.timelines\.sbs/u);
});
