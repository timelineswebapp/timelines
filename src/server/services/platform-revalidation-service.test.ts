import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { continuationPublished } from "@/src/server/services/platform-revalidation-service";

test("publication completion is the only runtime outcome that triggers revalidation", () => {
  assert.equal(continuationPublished({
    outcomes: [{ nextState: { stage: "completed" } }]
  }), true);
  assert.equal(continuationPublished({
    outcomes: [{ nextState: { stage: "extraction" } }]
  }), false);
  assert.equal(continuationPublished({ outcomes: [] }), false);
});

test("deployed revalidation endpoint covers homepage, search, sitemap, and timeline paths", async () => {
  const [route, service] = await Promise.all([
    readFile("app/api/cron/revalidate/route.ts", "utf8"),
    readFile("src/server/services/platform-revalidation-service.ts", "utf8")
  ]);
  for (const path of ['"/"', '"/search"', '"/sitemap.xml"']) {
    assert.match(route, new RegExp(path.replace("/", "\\/")));
  }
  assert.match(route, /revalidatePath\(path\)/);
  assert.match(route, /isAuthorizedCronRequest/);
  assert.match(route, /\/timeline\/\$\{slug\}/);
  assert.match(service, /listStaticSlugs\(50\)/);
  assert.match(service, /CRON_SECRET is required/);
});
