import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  assertNonProductionEnvironment,
  assertResetArguments,
  resetTables
} from "./factory-reset-core";

test("factory reset requires the exact explicit confirmation", () => {
  assert.throws(() => assertResetArguments([]), /--confirm TIMELINES/);
  assert.throws(() => assertResetArguments(["--confirm", "timelines"]), /--confirm TIMELINES/);
  assert.doesNotThrow(() => assertResetArguments(["--confirm", "TIMELINES"]));
});

test("factory reset refuses production runtime environments", () => {
  assert.throws(
    () => assertNonProductionEnvironment({ NODE_ENV: "production" }, "postgres://user@localhost/timelines_dev"),
    /disabled in production/
  );
  assert.throws(
    () => assertNonProductionEnvironment({ VERCEL_ENV: "production" }, "postgres://user@localhost/timelines_dev"),
    /disabled in production/
  );
});

test("factory reset refuses database identities marked as production", () => {
  assert.throws(
    () => assertNonProductionEnvironment({}, "postgres://user@db.example/timelines-production"),
    /identified as production/
  );
  assert.throws(
    () => assertNonProductionEnvironment({ DATABASE_ENV: "prod" }, "postgres://user@db.example/timelines"),
    /identified as production/
  );
});

test("factory reset allowlist excludes permanent institutional configuration", () => {
  for (const table of [
    "factory_operations_control",
    "factory_worker_capabilities",
    "factory_worker_policies",
    "factory_worker_versions",
    "factory_worker_permissions",
    "provider_execution_limits",
    "source_authority_records",
    "sources",
    "taxonomy_categories",
    "admin_security_audit_events",
    "admin_session_revocations"
  ]) {
    assert.equal((resetTables as readonly string[]).includes(table), false, `${table} must be preserved`);
  }
});

test("factory utilities use the shared operational environment loader", () => {
  for (const script of ["scripts/factory-reset.ts", "scripts/factory-seed.ts"]) {
    const source = readFileSync(script, "utf8");
    assert.match(
      source,
      /^import "@\/src\/server\/operations\/environment";/,
      `${script} must bootstrap the shared operations environment before other imports`
    );
  }
});
