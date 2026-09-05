import { buildScopeContract, type ArtifactContext } from "./contracts/builders";
import type { ScopeContract } from "./contracts";

export const TEST_CONTEXT: ArtifactContext = {
  corpusId: "test-clean-corpus",
  topicId: "topic-123",
  runId: "run-123",
  generation: 1,
  createdAt: "2026-09-06T00:00:00.000Z"
};

export function date(year: number, precision: "DAY" | "MONTH" | "YEAR" | "APPROXIMATE" = "YEAR", month: number | null = null, day: number | null = null) {
  return { year, month, day, precision, earliestYear: null, latestYear: null, label: String(Math.abs(year)) };
}

export function scopeFixture(overrides: Partial<Parameters<typeof buildScopeContract>[1]> = {}): ScopeContract {
  return buildScopeContract(TEST_CONTEXT, {
    version: 1,
    status: "LOCKED",
    title: "Apollo 11 Mission",
    language: "en",
    topicClass: "CLOSED_EPISODE",
    subjectDefinition: "The Apollo 11 lunar landing mission from launch through recovery.",
    includedQuestions: ["What operational events defined the Apollo 11 mission?"],
    excludedQuestions: ["Later cultural depictions outside the mission chronology"],
    chronologyStart: date(1969, "DAY", 7, 16),
    chronologyEnd: date(1969, "DAY", 7, 24),
    ongoingAsOf: null,
    contextBefore: date(1961, "YEAR"),
    contextAfter: date(1970, "YEAR"),
    precursorRule: "Research precursors only to explain mission readiness.",
    aftermathRule: "Research aftermath only to explain immediate mission consequences.",
    spatialScope: { included: ["Earth", "Moon"], excluded: [], boundaryRule: "Include mission operational locations." },
    centralEntities: [{ entityId: null, name: "Apollo 11", type: "Technology", language: "en" }],
    requiredDimensions: ["operational", "scientific"],
    expectedPhases: ["launch", "lunar operations", "return"],
    granularity: "DETAILED",
    explicitExclusions: ["Fictional portrayals"],
    uncertainties: [],
    researchBudget: { maximumGroundingCalls: 7, maximumProviderQueries: 40, maximumSourceDocuments: 60, maximumAtomicClaims: 300, maximumSemanticRepairs: 2, maximumTransportAttemptsPerCall: 3, maximumConcurrency: 3, maximumWorkerSeconds: 1200 },
    approvedByPolicy: "scope-contract-v2-a.1",
    ...overrides
  });
}
