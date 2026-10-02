export type ShadowThresholdInput = {
  counts: {
    corpus: number;
    completedKnowledgeSets: number;
    evidenceEligible: number;
    selectionPassed: number;
    eventLockAndCompositionPassed: number;
    timelineQualityPassed: number;
    sourceAuthorityPassed: number;
    readerPassed: number;
    endToEndPassed: number;
    unhandledFailures: number;
    lineageAndScopeVerified: number;
    providerUsageRecorded: number;
    providerBudgetsBounded: number;
  };
  byClass: Record<string, { total: number; passed: number; rate: number }>;
  protectedDeltas: Record<string, number>;
  latencies: number[];
  medianLatencyMs: number | null;
  p95LatencyMs: number | null;
  failureSignatures: string[];
  releaseIds: string[];
};

export function evaluateAutomatedShadowThresholds(input: ShadowThresholdInput) {
  const { counts } = input;
  return {
    completeCorpus: counts.corpus === 30,
    completedKnowledgeSetRate: counts.completedKnowledgeSets >= 27,
    evidenceEligibilityRate: counts.evidenceEligible >= 27,
    selectionRate: counts.selectionPassed >= 27,
    eventLockCompositionRate: counts.eventLockAndCompositionPassed >= 27,
    timelineQualityRate: counts.timelineQualityPassed >= 27,
    sourceAuthorityRate: counts.sourceAuthorityPassed >= 27,
    readerRate: counts.readerPassed >= 27,
    endToEndRate: counts.endToEndPassed >= 26,
    everyClassAtLeast75Percent: Object.keys(input.byClass).length === 9 && Object.values(input.byClass).every((value) => value.total > 0 && value.rate >= 0.75 && value.passed > 0),
    lineageIntegrity: counts.lineageAndScopeVerified === 30,
    scopeImmutability: counts.lineageAndScopeVerified === 30,
    providerUsageComplete: counts.providerUsageRecorded === 30,
    everySubjectWithinBudget: counts.providerBudgetsBounded === 30,
    generationReleaseParity: input.releaseIds.length === 30 && new Set(input.releaseIds).size === 1,
    zeroProtectedWrites: Object.values(input.protectedDeltas).every((delta) => delta === 0),
    latencyMedianWithin12Minutes: input.medianLatencyMs !== null && input.medianLatencyMs <= 720_000,
    latencyP95Within20Minutes: input.p95LatencyMs !== null && input.p95LatencyMs <= 1_200_000,
    noSubjectOverWorkerBound: input.latencies.length === 30 && input.latencies.every((latency) => latency <= 1_200_000),
    noMoreThanOneUnhandledProviderOrSystemFailure: counts.unhandledFailures <= 1,
    noRepeatedUnhandledFailureSignature: new Set(input.failureSignatures).size === input.failureSignatures.length
  };
}
