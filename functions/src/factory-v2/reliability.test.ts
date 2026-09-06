import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapPublisherRegistry } from "./authority";
import { buildEvidenceSegment } from "./contracts/builders";
import type { ResearchMap } from "./contracts";
import { admitSourcesByQuestion, selectEvidencePacket } from "./reliability";
import { TEST_CONTEXT } from "./test-fixtures";

const question = {
  questionId: "question-launch", text: "When did Apollo 11 launch from Kennedy Space Center?", phaseIds: ["phase-launch"], dimensionIds: ["dimension-operations"],
  claimTypesExpected: ["DATE", "OCCURRENCE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["Kennedy Space Center"], contested: false, dateCritical: true, priority: "CRITICAL", state: "UNRESEARCHED"
} as ResearchMap["questions"][number];

test("Evidence packet ranking preserves exact segments while rejecting navigation-first ordering", () => {
  const texts = ["Skip to content", "HOME", "Apollo 11 launched from Kennedy Space Center on July 16, 1969.", "Privacy and cookie settings"];
  const segments = texts.map((exactText, index) => buildEvidenceSegment(TEST_CONTEXT, { sourceSnapshotId: "snapshot-1", exactText, segmentType: "TEXT", startOffset: index * 100, endOffset: index * 100 + exactText.length, page: null, section: null, selector: null, extractionMethod: "SAFE_HTML_TEXT", sourceCompleteness: "FULL_SNAPSHOT" }));
  const packet = selectEvidencePacket({ question, segments, entityNames: ["Apollo 11"], maximumSegments: 2 });
  assert.equal(packet.segments.length, 1);
  assert.equal(packet.segments[0]!.exactText, texts[2]);
  assert.equal(packet.segments[0]!.evidenceSegmentId, segments[2]!.evidenceSegmentId);
});

test("Source admission treats the global source budget as a ceiling and prioritizes diverse known authority per question", () => {
  const map = { questions: [question] } as ResearchMap;
  const candidates = [
    { canonicalUrl: "https://www.nasa.gov/a", originalUrl: "https://www.nasa.gov/a", title: "NASA A", domain: "nasa.gov", queryId: "query-1", researchQuestionIds: [question.questionId], role: "AUTHORITY_TARGETED" as const, intendedSourceClass: "PRIMARY_INSTITUTIONAL" as const, discoveryOrder: 1 },
    { canonicalUrl: "https://www.nasa.gov/b", originalUrl: "https://www.nasa.gov/b", title: "NASA B", domain: "nasa.gov", queryId: "query-1", researchQuestionIds: [question.questionId], role: "AUTHORITY_TARGETED" as const, intendedSourceClass: "PRIMARY_INSTITUTIONAL" as const, discoveryOrder: 2 },
    { canonicalUrl: "https://example.edu/history", originalUrl: "https://example.edu/history", title: "Academic", domain: "example.edu", queryId: "query-1", researchQuestionIds: [question.questionId], role: "PHASE_DIMENSION" as const, intendedSourceClass: "SCHOLARLY_SECONDARY" as const, discoveryOrder: 3 },
    { canonicalUrl: "https://en.wikipedia.org/wiki/Apollo_11", originalUrl: "https://en.wikipedia.org/wiki/Apollo_11", title: "Wikipedia", domain: "wikipedia.org", queryId: "query-1", researchQuestionIds: [question.questionId], role: "ORIENTATION" as const, intendedSourceClass: "WIKIPEDIA" as const, discoveryOrder: 0 }
  ];
  const admitted = admitSourcesByQuestion({ candidates, map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 60, perQuestion: 2 });
  assert.equal(admitted.length, 2);
  assert.equal(admitted[0]!.domain, "nasa.gov");
  assert.equal(new Set(admitted.map((item) => item.domain)).size, 2);
  assert.equal(admitted.some((item) => item.domain === "wikipedia.org"), false);
});
