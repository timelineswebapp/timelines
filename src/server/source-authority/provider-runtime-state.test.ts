import test from "node:test";
import assert from "node:assert/strict";
import {
  getSourceProviderHealth,
  getSourceProviderRuntimeState,
  loadPersistentSourceProviderHealth,
  providerInCooldown,
  resilientFetch,
  resetSourceAuthorityRuntimeForTests,
  resetSourceProviderHealth,
  setSourceProviderRuntimeStoreForTests,
  sourceAuthorityRuntimeInitialized
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
    const response = await resilientFetch("https://www.wikidata.org/wiki/Special:EntityData/Q1.json", {
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

test("runtime bootstrap hydrates cooldown and history before failover decisions", async () => {
  resetSourceAuthorityRuntimeForTests();
  let listCalls = 0;
  setSourceProviderRuntimeStoreForTests({
    async list() {
      listCalls += 1;
      return [
        {
          provider: "dbpedia",
          consecutiveFailures: 3,
          cooldownUntil: Date.now() + 60_000,
          lastFailureAt: Date.now() - 1_000,
          lastSuccessAt: Date.now() - 120_000,
          lastFailureReason: "Source provider returned HTTP 503.",
          failureCount: 9,
          successCount: 4,
          recoveryCount: 2,
          lastRecoveredAt: Date.now() - 120_000
        }
      ];
    },
    async record(update) {
      return persistedFrom(update, 0);
    }
  });

  try {
    assert.equal(sourceAuthorityRuntimeInitialized(), false);
    assert.equal(await providerInCooldown("dbpedia"), true);
    assert.equal(sourceAuthorityRuntimeInitialized(), true);
    assert.equal(listCalls, 1);
    const [state] = getSourceProviderRuntimeState();
    assert.equal(state?.provider, "dbpedia");
    assert.equal(state?.consecutiveFailures, 3);
    assert.equal(state?.failureCount, 9);
    assert.equal(state?.successCount, 4);
    assert.equal(state?.recoveryCount, 2);
  } finally {
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceAuthorityRuntimeForTests();
  }
});

test("runtime recreation rehydrates persisted provider state exactly once before fetch decisions", async () => {
  resetSourceAuthorityRuntimeForTests();
  const originalFetch = globalThis.fetch;
  let listCalls = 0;
  const records: ProviderRuntimeStateUpdate[] = [];
  setSourceProviderRuntimeStoreForTests({
    async list() {
      listCalls += 1;
      return [
        {
          provider: "wikidata",
          consecutiveFailures: 1,
          cooldownUntil: null,
          lastFailureAt: Date.now() - 5_000,
          lastSuccessAt: Date.now() - 10_000,
          lastFailureReason: "previous failure",
          failureCount: 5,
          successCount: 7,
          recoveryCount: 3,
          lastRecoveredAt: Date.now() - 10_000
        }
      ];
    },
    async record(update) {
      records.push(update);
      return {
        provider: update.provider,
        consecutiveFailures: 0,
        cooldownUntil: null,
        lastFailureAt: update.outcome === "failure" ? update.occurredAt : Date.now() - 5_000,
        lastSuccessAt: update.outcome === "success" ? update.occurredAt : null,
        lastFailureReason: null,
        failureCount: 5,
        successCount: 8,
        recoveryCount: 4,
        lastRecoveredAt: update.outcome === "success" ? update.occurredAt : null
      };
    }
  });
  globalThis.fetch = (async () => new Response("ok", { status: 200 })) as typeof fetch;

  try {
    resetSourceAuthorityRuntimeForTests();
    const response = await resilientFetch("https://www.wikidata.org/wiki/Special:EntityData/Q1.json", {
      provider: "wikidata",
      accept: "text/plain",
      maxAttempts: 1
    });
    assert.equal(response.status, 200);
    assert.equal(listCalls, 1);
    assert.deepEqual(records.map((record) => record.outcome), ["success"]);
    const [state] = getSourceProviderRuntimeState();
    assert.equal(state?.failureCount, 5);
    assert.equal(state?.successCount, 8);
    assert.equal(state?.recoveryCount, 4);

    await resilientFetch("https://www.wikidata.org/wiki/Special:EntityData/Q1.json", {
      provider: "wikidata",
      accept: "text/plain",
      maxAttempts: 1
    });
    assert.equal(listCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    setSourceProviderRuntimeStoreForTests(null);
    resetSourceAuthorityRuntimeForTests();
  }
});
