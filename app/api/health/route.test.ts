import assert from "node:assert/strict";
import test from "node:test";
import { GET, getHealthResponse } from "./route";

test("health endpoint fails closed without required database configuration", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const response = await GET();
    const payload = await response.json() as { ok?: boolean; db?: boolean; env?: boolean; error?: string; timestamp?: string };

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate");
    assert.deepEqual(payload, {
      ok: false,
      db: false,
      env: false,
      error: "missing_environment",
      timestamp: payload.timestamp
    });
    assert.match(payload.timestamp || "", /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test("health endpoint reports database unavailability without exposing probe details", async () => {
  const logged: string[] = [];
  const response = await getHealthResponse({
    now: () => new Date("2026-10-16T12:00:00.000Z"),
    hasRequiredEnvironment: () => true,
    getSql: () => null,
    logHealthError: (message) => logged.push(message)
  });
  const payload = await response.json() as { ok?: boolean; db?: boolean; env?: boolean; error?: string; timestamp?: string };

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store, no-cache, must-revalidate");
  assert.deepEqual(payload, {
    ok: false,
    db: false,
    env: true,
    error: "database_unavailable",
    timestamp: "2026-10-16T12:00:00.000Z"
  });
  assert.deepEqual(logged, []);
});
