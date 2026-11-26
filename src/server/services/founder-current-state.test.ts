import assert from "node:assert/strict";
import test from "node:test";
import { currentInstitutionStatus } from "@/src/server/services/founder-current-state";

test("current Founder status is derived from V2/public-corpus facts, never legacy Factory records", () => {
  assert.equal(currentInstitutionStatus({
    availability: "available", publicCorpus: "available", deferredTopics: 0,
    scheduledRetries: 0, dueRetries: 0, terminalDeliveryFailures: 0
  }), "Healthy");
  assert.equal(currentInstitutionStatus({
    availability: "available", publicCorpus: "available", deferredTopics: 0,
    scheduledRetries: 0, dueRetries: 0, terminalDeliveryFailures: 1
  }), "Warning");
  assert.equal(currentInstitutionStatus({
    availability: "unavailable", publicCorpus: "unavailable", deferredTopics: 0,
    scheduledRetries: 0, dueRetries: 0, terminalDeliveryFailures: 0
  }), "Critical");
});
