import test from "node:test";
import assert from "node:assert/strict";
import {
  getSourceProviderHealth,
  resilientFetch,
  resetSourceProviderHealth,
  setSourceProviderRuntimeStoreForTests
} from "@/src/server/source-authority/resilience";

test("resilientFetch retries HTTP 429 responses and records provider health", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
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
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});

test("resilientFetch aborts timed out providers and retries unavailable providers", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
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
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});

test("resilientFetch retries unavailable providers before failing over to a later success", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
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
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});

test("resilientFetch rejects non-HTTPS provider URLs before network access", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      resilientFetch("http://www.wikidata.org/w/api.php", {
        provider: "wikidata",
        accept: "application/json",
        maxAttempts: 1
      }),
      /must use HTTPS/
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});

test("resilientFetch rejects hosts outside the selected provider boundary", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      resilientFetch("https://metadata.google.internal/latest", {
        provider: "wikidata",
        accept: "application/json",
        maxAttempts: 1
      }),
      /not allowed|blocked network/
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});

test("resilientFetch follows validated same-provider redirects", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (url) => {
    urls.push(String(url));
    if (urls.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://www.wikidata.org/wiki/Special:EntityData/Q1.json" }
      });
    }
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    const response = await resilientFetch("https://www.wikidata.org/w/api.php", {
      provider: "wikidata",
      accept: "application/json",
      maxAttempts: 1
    });
    assert.equal(response.status, 200);
    assert.deepEqual(urls, [
      "https://www.wikidata.org/w/api.php",
      "https://www.wikidata.org/wiki/Special:EntityData/Q1.json"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});

test("resilientFetch blocks redirect targets outside provider allowlist before following", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "https://metadata.google.internal/latest" }
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      resilientFetch("https://www.wikidata.org/w/api.php", {
        provider: "wikidata",
        accept: "application/json",
        maxAttempts: 1
      }),
      /not allowed|blocked network/
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});

test("resilientFetch blocks redirect targets using unsafe schemes", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests(null);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "file:///etc/passwd" }
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      resilientFetch("https://www.wikidata.org/w/api.php", {
        provider: "wikidata",
        accept: "application/json",
        maxAttempts: 1
      }),
      /must use HTTPS/
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});
