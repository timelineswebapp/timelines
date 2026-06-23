import test from "node:test";
import assert from "node:assert/strict";
import {
  getSourceProviderHealth,
  resilientFetch,
  resetSourceProviderHealth
} from "@/src/server/source-authority/resilience";

test("resilientFetch retries HTTP 429 responses and records provider health", async () => {
  resetSourceProviderHealth();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "0" }
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const response = await resilientFetch("https://www.wikidata.org/w/api.php", {
      provider: "wikidata",
      accept: "application/json",
      maxAttempts: 2
    });
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    const [health] = getSourceProviderHealth();
    assert.equal(health?.provider, "wikidata");
    assert.equal(health?.consecutiveFailures, 0);
    assert.equal(health?.cooldownUntil, null);
    assert.equal(health?.lastFailureReason, null);
    assert.equal(typeof health?.lastSuccessAt, "number");
  } finally {
    globalThis.fetch = originalFetch;
    resetSourceProviderHealth();
  }
});

test("resilientFetch aborts timed out providers and retries unavailable providers", async () => {
  resetSourceProviderHealth();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (_url, init) => {
    calls += 1;
    if (calls === 1) {
      await new Promise((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        setTimeout(resolve, 50);
      });
    }
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    const response = await resilientFetch("https://lookup.dbpedia.org/api/search", {
      provider: "dbpedia",
      accept: "application/json",
      timeoutMs: 1,
      maxAttempts: 2
    });
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    resetSourceProviderHealth();
  }
});

test("resilientFetch retries unavailable providers before failing over to a later success", async () => {
  resetSourceProviderHealth();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls < 3) {
      return new Response("unavailable", { status: 503 });
    }
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    const response = await resilientFetch("https://catalog.archives.gov/api/v1/", {
      provider: "nara",
      accept: "application/json",
      maxAttempts: 3
    });
    assert.equal(response.status, 200);
    assert.equal(calls, 3);
    const [health] = getSourceProviderHealth();
    assert.equal(health?.provider, "nara");
    assert.equal(health?.consecutiveFailures, 0);
  } finally {
    globalThis.fetch = originalFetch;
    resetSourceProviderHealth();
  }
});
