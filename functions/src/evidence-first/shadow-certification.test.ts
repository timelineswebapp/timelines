import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAutomatedShadowThresholds, type ShadowThresholdInput } from "./shadow-certification";

function passingInput(): ShadowThresholdInput {
  const byClass = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`class-${index}`, { total: index < 3 ? 4 : 3, passed: index < 3 ? 3 : 3, rate: index < 3 ? 0.75 : 1 }]));
  return {
    counts: { corpus: 30, completedKnowledgeSets: 27, evidenceEligible: 27, selectionPassed: 27, eventLockAndCompositionPassed: 27, timelineQualityPassed: 27, sourceAuthorityPassed: 27, readerPassed: 27, endToEndPassed: 26, unhandledFailures: 1, lineageAndScopeVerified: 30, providerUsageRecorded: 30, providerBudgetsBounded: 30 },
    byClass,
    protectedDeltas: { governance: 0, library: 0, public: 0 },
    latencies: Array(30).fill(720_000),
    medianLatencyMs: 720_000,
    p95LatencyMs: 1_200_000,
    failureSignatures: ["one-terminal-failure"],
    releaseIds: Array(30).fill("release-1")
  };
}

test("frozen shadow thresholds accept only the exact production-grade boundary", () => {
  assert.ok(Object.values(evaluateAutomatedShadowThresholds(passingInput())).every(Boolean));
});

test("every zero-defect, class, reliability, budget, and rate boundary fails independently", () => {
  const mutations: Array<(input: ShadowThresholdInput) => void> = [
    (input) => { input.counts.completedKnowledgeSets = 26; },
    (input) => { input.counts.endToEndPassed = 25; },
    (input) => { input.counts.lineageAndScopeVerified = 29; },
    (input) => { input.counts.providerUsageRecorded = 29; },
    (input) => { input.counts.providerBudgetsBounded = 29; },
    (input) => { input.protectedDeltas.public = 1; },
    (input) => { input.releaseIds[29] = "release-2"; },
    (input) => { input.p95LatencyMs = 1_200_001; },
    (input) => { input.latencies[29] = 1_200_001; },
    (input) => { input.counts.unhandledFailures = 2; input.failureSignatures = ["same", "same"]; },
    (input) => { input.byClass["class-0"] = { total: 4, passed: 2, rate: 0.5 }; }
  ];
  for (const mutate of mutations) {
    const input = passingInput();
    mutate(input);
    assert.ok(Object.values(evaluateAutomatedShadowThresholds(input)).some((value) => !value));
  }
});
