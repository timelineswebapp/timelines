import test from "node:test";
import assert from "node:assert/strict";
import {
  getSourceProviderHealth,
  loadPersistentSourceProviderHealth,
  resilientFetch,
  resetSourceProviderHealth,
  setSourceProviderRuntimeStoreForTests
} from "@/src/server/source-authority/resilience";
import type { ProviderRuntimeState, ProviderRuntimeStateUpdate } from "@/src/server/repositories/provider-runtime-state-repository";

function persistedFrom(update: ProviderRuntimeStateUpdate, consecutiveFailures: number): ProviderRuntimeState {
  return {
    provider: update.provider,
    consecutiveFailures,
    cooldownUntil: update.outcome === "failure" ? update.cooldownUntil : null,
    lastFailureAt: update.outcome === "failure" ? update.occurredAt : null,
    lastSuccessAt: update.outcome === "success" ? update.occurredAt : null,
    lastFailureReason: update.outcome === "failure" ? update.reason : null,
    failureCount: update.outcome === "failure" ? 1 : 0,
    successCount: update.outcome === "success" ? 1 : 0,
    recoveryCount: update.outcome === "success" && consecutiveFailures > 0 ? 1 : 0,
    lastRecoveredAt: null
  };
}

test("resilientFetch persists provider failure and recovery state", async () => {
  resetSourceProviderHealth();
  const originalFetch = globalThis.fetch;
  const updates: ProviderRuntimeStateUpdate[] = [];
  setSourceProviderRuntimeStoreForTests({
    async list() {
      return [];
    },
    async record(update) {
      updates.push(update);
      return persistedFrom(update, update.outcome === "failure" ? 1 : 0);
    }
  });
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) return new Response("unavailable", { status: 503 });
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    const response = await resilientFetch("https://example.test/source", {
      provider: "wikidata",
      accept: "text/plain",
      maxAttempts: 2
    });
    assert.equal(response.status, 200);
    assert.deepEqual(updates.map((update) => update.outcome), ["failure", "success"]);
    assert.equal(getSourceProviderHealth()[0]?.consecutiveFailures, 0);
  } finally {
    globalThis.fetch = originalFetch;
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});

test("persistent provider health can hydrate runtime cache", async () => {
  resetSourceProviderHealth();
  setSourceProviderRuntimeStoreForTests({
    async list() {
      return [
        {
          provider: "dbpedia",
          consecutiveFailures: 2,
          cooldownUntil: 1_800_000_000_000,
          lastFailureAt: 1_799_999_999_000,
          lastSuccessAt: null,
          lastFailureReason: "Source provider returned HTTP 503.",
          failureCount: 2,
          successCount: 0,
          recoveryCount: 0,
          lastRecoveredAt: null
        }
      ];
    },
    async record(update) {
      return persistedFrom(update, 0);
    }
  });

  try {
    const health = await loadPersistentSourceProviderHealth();
    assert.equal(health[0]?.provider, "dbpedia");
    assert.equal(health[0]?.consecutiveFailures, 2);
    assert.equal(health[0]?.lastFailureReason, "Source provider returned HTTP 503.");
  } finally {
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceProviderHealth();
  }
});
