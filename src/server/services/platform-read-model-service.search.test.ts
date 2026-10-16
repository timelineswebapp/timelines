import assert from "node:assert/strict";
import test from "node:test";
import { platformReadModelRepository } from "@/src/server/repositories/platform-read-model-repository";
import { platformReadModelService } from "@/src/server/services/platform-read-model-service";

test("search preserves the server-reported total when a bounded deep page has no rows", async () => {
  const original = platformReadModelRepository.searchPublishedReadModels;
  platformReadModelRepository.searchPublishedReadModels = async () => ({ total: 21, matches: [] });
  try {
    assert.deepEqual(await platformReadModelService.searchKnowledge("chronology", 20, 20), {
      query: "chronology",
      total: 21,
      items: []
    });
  } finally {
    platformReadModelRepository.searchPublishedReadModels = original;
  }
});
