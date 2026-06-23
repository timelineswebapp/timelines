import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const adminApiRoot = join(process.cwd(), "app/api/admin");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(fullPath);
    return entry.name === "route.ts" ? [fullPath] : [];
  });
}

function expectedRole(pathname: string): string {
  if (pathname.includes("/governance/audit-records/")) return "auditor";
  if (pathname.includes("/factory/")) return "factory_operator";
  if (pathname.includes("/governance/")) return "governance_operator";
  if (pathname.includes("/historical-library/")) return "library_operator";
  return "admin";
}

test("admin routes declare route-family RBAC requirements", () => {
  for (const file of routeFiles(adminApiRoot)) {
    const source = readFileSync(file, "utf8");
    const withAdminAuthCount = [...source.matchAll(/withAdminAuth\(/g)].length;
    const role = expectedRole(file);
    const roleCount = [...source.matchAll(new RegExp(`roles:\\s*\\[\\s*"${role}"`, "g"))].length;

    assert.equal(roleCount, withAdminAuthCount, `${file} must declare ${role} for every admin handler`);
  }
});
