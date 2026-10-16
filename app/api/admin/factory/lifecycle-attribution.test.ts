import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const routes = [
  "app/api/admin/factory/objects/route.ts",
  "app/api/admin/factory/artifacts/route.ts",
  "app/api/admin/factory/objects/[id]/transition/route.ts",
  "app/api/admin/factory/feedback/intake/route.ts",
  "app/api/admin/factory/feedback/[id]/transition/route.ts",
  "app/api/admin/factory/feedback/[id]/revision-plan/route.ts",
  "app/api/admin/factory/package-drafts/route.ts",
  "app/api/admin/factory/package-drafts/[id]/transition/route.ts",
  "app/api/admin/factory/package-drafts/[id]/versions/route.ts",
  "app/api/admin/factory/revision-plans/[id]/prepare-resubmission/route.ts"
];

test("Factory lifecycle mutations derive actor attribution from authenticated identity", () => {
  for (const route of routes) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /withAdminAuth\(async \(request: Request,[\s\S]*identity\)/);
    assert.match(source, /actor: identity\.operatorId/);
  }
});
